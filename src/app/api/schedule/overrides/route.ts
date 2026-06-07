import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { matchNaturalWorkout } from '@/lib/resolve-workout'
import { localDateKey, startOfWeekKey, weekWindowKeys } from '@/lib/date'
import type { Program, WorkoutDay } from '@/types/database'

// GET /api/schedule/overrides?start=YYYY-MM-DD&days=7
// Returns each calendar date in the window with its resolved workout_day_id,
// the natural workout_day_id, and whether an override is active.
export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const url = new URL(request.url)
  const startParam = url.searchParams.get('start')
  const daysParam = parseInt(url.searchParams.get('days') ?? '7', 10)
  const windowLen = Number.isInteger(daysParam) && daysParam > 0 && daysParam <= 28 ? daysParam : 7

  if (!startParam || !/^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
    return NextResponse.json({ error: 'start (YYYY-MM-DD) is required' }, { status: 400 })
  }

  const { data: programRaw } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const program = programRaw as Program | null
  if (!program) return NextResponse.json({ error: 'No active program' }, { status: 404 })

  const { data: daysRaw } = await supabase
    .from('workout_days')
    .select('*')
    .eq('program_id', program.id)
  const days = (daysRaw ?? []) as WorkoutDay[]

  const dates: string[] = []
  const [sy, sm, sd] = startParam.split('-').map(Number)
  for (let i = 0; i < windowLen; i++) {
    dates.push(localDateKey(new Date(sy, sm - 1, sd + i)))
  }

  const { data: overridesRaw } = await supabase
    .from('schedule_overrides')
    .select('date, workout_day_id')
    .eq('program_id', program.id)
    .in('date', dates)

  const overrideByDate = new Map(
    ((overridesRaw ?? []) as Array<{ date: string; workout_day_id: string }>).map((o) => [o.date, o.workout_day_id])
  )

  const { data: sessionsRaw } = await supabase
    .from('sessions')
    .select('date, status')
    .eq('program_id', program.id)
    .in('date', dates)
  const sessionByDate = new Map(
    ((sessionsRaw ?? []) as Array<{ date: string; status: string }>).map((s) => [s.date, s.status])
  )

  const result = dates.map((date) => {
    const [y, m, d] = date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const natural = matchNaturalWorkout(days, dow, program)
    const overrideId = overrideByDate.get(date) ?? null
    const resolvedId = overrideId ?? natural?.id ?? null
    const sessionStatus = sessionByDate.get(date) ?? null
    const locked = sessionStatus !== null && sessionStatus !== 'undone' && sessionStatus !== 'skipped'
    return {
      date,
      dayOfWeek: dow,
      naturalWorkoutDayId: natural?.id ?? null,
      resolvedWorkoutDayId: resolvedId,
      isOverridden: overrideId !== null,
      sessionStatus,
      locked,
    }
  })

  return NextResponse.json({
    programId: program.id,
    days: days.map((d) => ({
      id: d.id,
      day_of_week: d.day_of_week,
      week_type: d.week_type,
      variant: d.variant,
      name: d.name,
      type: d.type,
      tag: d.tag,
      is_volume: d.is_volume,
    })),
    schedule: result,
  })
}

// POST /api/schedule/overrides  { dateA, dateB }  — swaps the resolved workouts
// for two dates. Each date's override is set to the OTHER date's currently
// resolved workout; if that equals the date's natural workout, the override is
// cleared instead so the table only holds genuine deviations.
export async function POST(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const body: { dateA?: string; dateB?: string } = await request.json()
  const { dateA, dateB } = body
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateA || !dateB || !dateRe.test(dateA) || !dateRe.test(dateB)) {
    return NextResponse.json({ error: 'dateA and dateB (YYYY-MM-DD) are required' }, { status: 400 })
  }
  if (dateA === dateB) {
    return NextResponse.json({ error: 'dateA and dateB must differ' }, { status: 400 })
  }

  // Only allow swapping within the current Monday-anchored week, so a stale
  // client held across a week boundary can't write overrides to a past week.
  const thisWeek = new Set(weekWindowKeys(startOfWeekKey(), 7))
  if (!thisWeek.has(dateA) || !thisWeek.has(dateB)) {
    return NextResponse.json({ error: 'Can only swap days within the current week' }, { status: 400 })
  }

  const { data: programRaw } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  const program = programRaw as Program | null
  if (!program) return NextResponse.json({ error: 'No active program' }, { status: 404 })

  // Block swapping a date that already has a real (logged) session.
  const { data: lockedSessions } = await supabase
    .from('sessions')
    .select('date, status')
    .eq('program_id', program.id)
    .in('date', [dateA, dateB])
    .in('status', ['completed', 'partial'])
  if (lockedSessions && lockedSessions.length > 0) {
    return NextResponse.json(
      { error: 'Cannot swap a day that already has a logged session' },
      { status: 409 }
    )
  }

  const { data: daysRaw } = await supabase
    .from('workout_days')
    .select('*')
    .eq('program_id', program.id)
  const days = (daysRaw ?? []) as WorkoutDay[]

  const { data: overridesRaw } = await supabase
    .from('schedule_overrides')
    .select('date, workout_day_id')
    .eq('program_id', program.id)
    .in('date', [dateA, dateB])
  const overrideByDate = new Map(
    ((overridesRaw ?? []) as Array<{ date: string; workout_day_id: string }>).map((o) => [o.date, o.workout_day_id])
  )

  function resolvedFor(date: string): { resolvedId: string | null; naturalId: string | null } {
    const [y, m, d] = date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const natural = matchNaturalWorkout(days, dow, program!)
    const overrideId = overrideByDate.get(date) ?? null
    return { resolvedId: overrideId ?? natural?.id ?? null, naturalId: natural?.id ?? null }
  }

  const a = resolvedFor(dateA)
  const b = resolvedFor(dateB)
  if (!a.resolvedId || !b.resolvedId) {
    return NextResponse.json({ error: 'One of the dates has no resolvable workout' }, { status: 400 })
  }

  // After the swap: dateA shows b.resolvedId, dateB shows a.resolvedId.
  async function applyOverride(date: string, targetWorkoutId: string, naturalId: string | null) {
    if (targetWorkoutId === naturalId) {
      await db.from('schedule_overrides').delete().eq('program_id', program!.id).eq('date', date)
    } else {
      await db
        .from('schedule_overrides')
        .upsert(
          { program_id: program!.id, date, workout_day_id: targetWorkoutId },
          { onConflict: 'program_id,date' }
        )
    }
    // Keep a non-locked session row (skipped/undone) pointed at the resolved
    // workout so history doesn't attribute it to the pre-swap workout.
    await db
      .from('sessions')
      .update({ workout_day_id: targetWorkoutId })
      .eq('program_id', program!.id)
      .eq('date', date)
      .in('status', ['skipped', 'undone'])
  }

  await applyOverride(dateA, b.resolvedId, a.naturalId)
  await applyOverride(dateB, a.resolvedId, b.naturalId)

  return NextResponse.json({ ok: true })
}

// DELETE /api/schedule/overrides?date=YYYY-MM-DD — clears one date's override,
// restoring its natural workout.
export async function DELETE(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
  }

  const { data: programRaw } = await supabase
    .from('programs')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  const program = programRaw as { id: string } | null
  if (!program) return NextResponse.json({ error: 'No active program' }, { status: 404 })

  // A date with a logged session is locked to the workout that was performed —
  // clearing its override would detach the displayed plan from logged history.
  const { data: lockedSession } = await supabase
    .from('sessions')
    .select('status')
    .eq('program_id', program.id)
    .eq('date', date)
    .in('status', ['completed', 'partial'])
    .maybeSingle()
  if (lockedSession) {
    return NextResponse.json(
      { error: 'Cannot clear a day that already has a logged session' },
      { status: 409 }
    )
  }

  const { error: deleteError } = await db
    .from('schedule_overrides')
    .delete()
    .eq('program_id', program.id)
    .eq('date', date)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
