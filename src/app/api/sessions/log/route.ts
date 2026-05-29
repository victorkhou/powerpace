import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { processLift, recompute, PROGRESSABLE, AUTO_KEYS } from '@/lib/progression'
import type { Program, WorkingWeight } from '@/types/database'

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

export async function POST(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const body: LogSessionRequest = await request.json()
  const { programId, workoutDayId, date, weekNumber, weekType, fridayAlt, sets, runLogs, notes, isPartial } = body

  const { data: programRaw } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .eq('user_id', user.id)
    .single()

  const program = programRaw as Program | null
  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

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

  const { data: session, error: sessionError } = await db
    .from('sessions')
    .insert({
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
    })
    .select()
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message ?? 'Failed to create session' }, { status: 500 })
  }

  if (sets.length > 0) {
    const { error: setsError } = await db.from('session_sets').insert(
      sets.map((s: (typeof sets)[number]) => ({
        session_id: session.id,
        exercise_id: s.exerciseId,
        set_number: s.setNumber,
        completed: s.completed,
        weight_lbs: s.weightLbs,
        reps_target: s.repsTarget,
        reps_actual: s.repsActual,
      }))
    )
    if (setsError) {
      await db.from('sessions').delete().eq('id', session.id)
      return NextResponse.json({ error: setsError.message }, { status: 500 })
    }
  }

  if (runLogs.length > 0) {
    await db.from('run_logs').insert(
      runLogs.map((r: (typeof runLogs)[number]) => ({
        session_id: session.id,
        exercise_id: r.exerciseId,
        pace_actual: r.paceActual,
        pace_target: r.paceTarget,
      }))
    )
  }

  // Run progression engine
  const changes: ChangeEntry[] = []
  const updatedWeights: Record<string, number> = { ...weightSnapshot }

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
      await db
        .from('working_weights')
        .update({
          weight_lbs: result.weight,
          failures: result.failures,
          streak: result.streak,
          pr_lbs: result.pr,
          updated_at: new Date().toISOString(),
        })
        .eq('program_id', programId)
        .eq('key', firstSet.weightKey)

      let changeReason: string
      if (result.status === 'up') changeReason = 'progression'
      else if (result.status === 'down') changeReason = 'failure_reset'
      else changeReason = 'failure_hold'

      await db.from('weight_history').insert({
        program_id: programId,
        session_id: session.id,
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

  // Recompute all auto-derived volume weights (87.5% of intensity)
  const recomputed = recompute(updatedWeights)
  for (const key of AUTO_KEYS) {
    const newVal = recomputed[key]
    const ww = weightsMap[key]
    if (ww && newVal !== undefined && newVal !== ww.weight_lbs) {
      await db
        .from('working_weights')
        .update({ weight_lbs: newVal, updated_at: new Date().toISOString() })
        .eq('program_id', programId)
        .eq('key', key)
    }
  }

  // Friday alternation advance: if this is Friday + Week A, flip friday_alt
  const dayOfWeek = new Date(date).getDay()
  if (dayOfWeek === 5 && weekType === 'A') {
    const newAlt = program.friday_alt === 'A1' ? 'A2' : 'A1'
    await db.from('programs').update({ friday_alt: newAlt }).eq('id', programId)
  }

  return NextResponse.json({ sessionId: session.id, changes })
}
