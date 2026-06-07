import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { processLift, recompute, PROGRESSABLE, AUTO_KEYS } from '@/lib/progression'
import { isFriday } from '@/lib/date'
import { requireProgram } from '@/lib/ownership'
import type { WorkingWeight } from '@/types/database'

export type LogSessionRequest = {
  programId: string
  workoutDayId: string
  date: string
  weekNumber: number
  weekType: 'A' | 'B'
  fridayAlt: string | null
  sets: Array<{
    exerciseId: string
    weightKey: string | null
    setNumber: number
    completed: boolean
    weightLbs: number | null
    repsTarget: number
    repsActual: number | null
    progressionType: string
  }>
  runLogs: Array<{
    exerciseId: string
    paceActual: string | null
    paceTarget: string | null
  }>
  notes: string
  isPartial: boolean
}

export type ChangeEntry = {
  key: string
  status: 'up' | 'down' | 'hold'
  from: number
  to: number
  isPR?: boolean
  reason?: string
  streak?: number
  failures?: number
}

// Runtime validation: request.json() is `any`, so the LogSessionRequest
// annotation is compile-time only. Validate the untrusted body before any of
// it reaches the volume sum, the progression engine, or the DB.
function validateLogBody(raw: unknown): { body: LogSessionRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'invalid body' }
  const b = raw as Record<string, unknown>
  if (typeof b.programId !== 'string' || !b.programId) return { error: 'programId required' }
  if (typeof b.workoutDayId !== 'string' || !b.workoutDayId) return { error: 'workoutDayId required' }
  if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return { error: 'invalid date' }
  if (b.weekType !== 'A' && b.weekType !== 'B') return { error: 'invalid weekType' }
  if (!Number.isInteger(b.weekNumber) || (b.weekNumber as number) < 1) return { error: 'invalid weekNumber' }
  if (b.fridayAlt !== null && b.fridayAlt !== 'A1' && b.fridayAlt !== 'A2') return { error: 'invalid fridayAlt' }
  if (typeof b.isPartial !== 'boolean') return { error: 'isPartial must be a boolean' }
  if (typeof b.notes !== 'string') return { error: 'notes must be a string' }
  if (!Array.isArray(b.sets)) return { error: 'sets must be an array' }
  for (const s of b.sets as unknown[]) {
    if (typeof s !== 'object' || s === null) return { error: 'invalid set' }
    const set = s as Record<string, unknown>
    if (typeof set.exerciseId !== 'string') return { error: 'set.exerciseId required' }
    if (set.weightKey !== null && typeof set.weightKey !== 'string') return { error: 'invalid set.weightKey' }
    if (!Number.isInteger(set.setNumber)) return { error: 'invalid set.setNumber' }
    if (typeof set.completed !== 'boolean') return { error: 'invalid set.completed' }
    if (set.weightLbs !== null && (typeof set.weightLbs !== 'number' || !Number.isFinite(set.weightLbs) || set.weightLbs < 0)) {
      return { error: 'invalid set.weightLbs' }
    }
    if (!Number.isInteger(set.repsTarget) || (set.repsTarget as number) < 0) return { error: 'invalid set.repsTarget' }
  }
  if (!Array.isArray(b.runLogs)) return { error: 'runLogs must be an array' }
  for (const r of b.runLogs as unknown[]) {
    if (typeof r !== 'object' || r === null) return { error: 'invalid runLog' }
    const run = r as Record<string, unknown>
    if (typeof run.exerciseId !== 'string') return { error: 'runLog.exerciseId required' }
  }
  return { body: raw as LogSessionRequest }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user, supabase, db } = auth

  const parsed = validateLogBody(await request.json())
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { programId, workoutDayId, date, weekNumber, weekType, fridayAlt, sets, runLogs, notes, isPartial } = parsed.body

  const owned = await requireProgram(supabase, user, programId)
  if ('error' in owned) return owned.error
  const { program } = owned

  const { data: weightsArrRaw } = await supabase
    .from('working_weights')
    .select('*')
    .eq('program_id', programId)

  const weightsArr = (weightsArrRaw ?? []) as WorkingWeight[]
  const weightsMap = Object.fromEntries(weightsArr.map((w) => [w.key, w]))

  const weightSnapshot = Object.fromEntries(
    Object.entries(weightsMap).map(([k, v]) => [k, v.weight_lbs])
  )

  const setsByExercise: Record<string, typeof sets> = {}
  for (const s of sets) {
    if (!setsByExercise[s.exerciseId]) setsByExercise[s.exerciseId] = []
    setsByExercise[s.exerciseId].push(s)
  }

  // Volume excludes auto-derived (volume) keys to avoid double-counting against intensity.
  const volume = sets
    .filter((s) => s.completed && s.weightLbs != null && s.weightKey != null && !AUTO_KEYS.has(s.weightKey))
    .reduce((acc, s) => acc + (s.weightLbs! * s.repsTarget), 0)

  // ── Pure computation (tested engine) — no writes happen until the RPC ──
  const changes: ChangeEntry[] = []
  const updatedWeights: Record<string, number> = { ...weightSnapshot }
  const weightUpdates: Array<{ key: string; weight_lbs: number; failures: number; streak: number; pr_lbs: number }> = []
  const weightHistory: Array<{ weight_key: string; weight_before: number; weight_after: number; change_reason: string; failures_at_change: number }> = []

  for (const [, exSets] of Object.entries(setsByExercise)) {
    const firstSet = exSets[0]
    if (!firstSet.weightKey || !PROGRESSABLE.has(firstSet.weightKey)) continue
    if (firstSet.progressionType !== 'linear') continue

    const ww = weightsMap[firstSet.weightKey]
    if (!ww) continue

    const allCompleted = exSets.every((s) => s.completed)
    const result = processLift({
      key: firstSet.weightKey,
      completed: allCompleted,
      weight: ww.weight_lbs,
      failures: ww.failures,
      streak: ww.streak,
      pr: ww.pr_lbs ?? ww.weight_lbs,
    })

    if (result.status !== 'hold' || result.failures !== ww.failures) {
      weightUpdates.push({
        key: firstSet.weightKey,
        weight_lbs: result.weight,
        failures: result.failures,
        streak: result.streak,
        pr_lbs: result.pr,
      })

      let changeReason: string
      if (result.status === 'up') changeReason = 'progression'
      else if (result.status === 'down') changeReason = 'failure_reset'
      else changeReason = 'failure_hold'

      weightHistory.push({
        weight_key: firstSet.weightKey,
        weight_before: ww.weight_lbs,
        weight_after: result.weight,
        change_reason: changeReason,
        failures_at_change: result.failures,
      })

      updatedWeights[firstSet.weightKey] = result.weight

      changes.push({
        key: firstSet.weightKey,
        status: result.status === 'hold' ? 'hold' : result.status,
        from: ww.weight_lbs,
        to: result.weight,
        isPR: result.status === 'up' ? result.isPR : undefined,
        streak: result.streak,
        failures: result.failures,
      })
    } else {
      changes.push({
        key: firstSet.weightKey,
        status: 'hold',
        from: ww.weight_lbs,
        to: ww.weight_lbs,
        failures: result.failures,
        streak: result.streak,
      })
    }
  }

  // Recompute auto-derived volume weights (only push genuine changes).
  const recomputed = recompute(updatedWeights, program.volume_pct)
  for (const key of AUTO_KEYS) {
    const newVal = recomputed[key]
    const ww = weightsMap[key]
    if (ww && newVal !== undefined && newVal !== ww.weight_lbs) {
      weightUpdates.push({
        key,
        weight_lbs: newVal,
        failures: ww.failures,
        streak: ww.streak,
        pr_lbs: ww.pr_lbs ?? ww.weight_lbs,
      })
    }
  }

  const newFridayAlt =
    isFriday(date) && weekType === 'A' ? (program.friday_alt === 'A1' ? 'A2' : 'A1') : null

  // ── Single atomic write: session + sets + run logs + weight updates +
  // history + friday_alt flip all commit together, or none do. ──
  const { data: rpcResult, error: rpcError } = await db.rpc('log_session', {
    payload: {
      session: {
        program_id: programId,
        workout_day_id: workoutDayId,
        date,
        week_number: weekNumber,
        week_type: weekType,
        friday_alt: fridayAlt,
        status: isPartial ? 'partial' : 'completed',
        notes: notes || null,
        volume_lbs: volume,
        weight_snapshot: weightSnapshot,
        logged_at: new Date().toISOString(),
      },
      sets: sets.map((s) => ({
        exercise_id: s.exerciseId,
        set_number: s.setNumber,
        completed: s.completed,
        weight_lbs: s.weightLbs,
        reps_target: s.repsTarget,
        reps_actual: s.repsActual,
      })),
      runLogs: runLogs.map((r) => ({
        exercise_id: r.exerciseId,
        pace_actual: r.paceActual,
        pace_target: r.paceTarget,
      })),
      weightUpdates,
      weightHistory,
      newFridayAlt,
    },
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  const sessionId = (rpcResult as { sessionId: string } | null)?.sessionId
  return NextResponse.json({ sessionId, changes })
}
