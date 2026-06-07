import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { seedProgram } from '@/lib/seed'
import { resolveWorkoutForDate } from '@/lib/resolve-workout'
import type { Program, WorkoutDay, Exercise, WorkingWeight } from '@/types/database'

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await getAuthenticatedUser()
  if (authError || !user) return authError!

  // Client passes its local day-of-week and date so we use the user's timezone,
  // not the server's UTC. Fall back to server time if absent.
  const url = new URL(request.url)
  const dowParam = url.searchParams.get('dow')
  const dateParam = url.searchParams.get('date')
  const clientDow = dowParam !== null ? parseInt(dowParam, 10) : null
  const clientDate = dateParam ?? null

  // At most one active program per user is guaranteed by a partial unique index
  // (migration 009); maybeSingle tolerates the zero-row case (first-time user)
  // without throwing, so we can fall through to seeding.
  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (programError || !program) {
    try {
      const programId = await seedProgram(supabase, user.id)
      const { data: seeded } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single()
      if (!seeded) return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
      return buildResponse(seeded as Program, supabase, clientDow, clientDate)
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  return buildResponse(program as Program, supabase, clientDow, clientDate)
}

async function buildResponse(
  program: Program,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server')['createClient']>>,
  clientDow: number | null,
  clientDate: string | null
) {
  const dayOfWeek = clientDow ?? new Date().getDay()
  const todayDate = clientDate ?? new Date().toISOString().split('T')[0]

  // Load all workout days for the program so an override (which points at any
  // day_of_week) can resolve, then apply a per-date override if one exists.
  const { data: allDays } = await supabase
    .from('workout_days')
    .select('*')
    .eq('program_id', program.id)

  const days = (allDays ?? []) as WorkoutDay[]

  const { data: override } = await supabase
    .from('schedule_overrides')
    .select('workout_day_id')
    .eq('program_id', program.id)
    .eq('date', todayDate)
    .maybeSingle()

  const overrideId = (override as { workout_day_id: string } | null)?.workout_day_id ?? null
  const todayWorkout = resolveWorkoutForDate(days, dayOfWeek, program, overrideId)

  let exercises: Exercise[] = []
  if (todayWorkout?.id) {
    const { data: ex } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_day_id', todayWorkout.id)
      .order('sort_order')
    exercises = (ex ?? []) as Exercise[]
  }

  const { data: weightsArr } = await supabase
    .from('working_weights')
    .select('*')
    .eq('program_id', program.id)

  const weights: Record<string, WorkingWeight> = Object.fromEntries(
    ((weightsArr ?? []) as WorkingWeight[]).map((w) => [w.key, w])
  )

  const { data: todaySession } = await supabase
    .from('sessions')
    .select('id, status, rpe')
    .eq('program_id', program.id)
    .eq('date', todayDate)
    .maybeSingle()

  return NextResponse.json({
    program,
    todayWorkout,
    exercises,
    weights,
    todaySession,
  })
}
