import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { seedProgram } from '@/lib/seed'
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

  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

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
  const weekType = program.week_type
  const fridayAlt = program.friday_alt

  // Match day_of_week + (week_type='both' or current). For Tue/Fri Week A
  // with variants, pick the one matching friday_alt.
  const { data: candidateDays } = await supabase
    .from('workout_days')
    .select('*')
    .eq('program_id', program.id)
    .eq('day_of_week', dayOfWeek)

  const days = (candidateDays ?? []) as WorkoutDay[]

  let todayWorkout: WorkoutDay | null = null
  for (const d of days) {
    if (d.week_type !== 'both' && d.week_type !== weekType) continue
    if (d.variant !== null) {
      if (d.variant === fridayAlt) { todayWorkout = d; break }
    } else {
      todayWorkout = d
    }
  }

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
