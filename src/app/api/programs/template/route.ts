import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireActiveProgram } from '@/lib/ownership'
import type { WorkoutDay, Exercise } from '@/types/database'

export type ProgramTemplate = {
  programId: string
  days: Array<WorkoutDay & { exercises: Exercise[] }>
}

export async function GET() {
  const { user, supabase, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const res = await requireActiveProgram(supabase, user)
  if ('error' in res) return res.error
  const { program } = res

  const { data: days } = await supabase
    .from('workout_days')
    .select('*')
    .eq('program_id', (program as { id: string }).id)
    .order('day_of_week', { ascending: true })
    .order('week_type', { ascending: true })
    .order('variant', { ascending: true, nullsFirst: true })

  const dayList = (days ?? []) as WorkoutDay[]

  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .in('workout_day_id', dayList.map((d) => d.id))
    .order('sort_order', { ascending: true })

  const exByDay: Record<string, Exercise[]> = {}
  for (const e of (exercises ?? []) as Exercise[]) {
    if (!exByDay[e.workout_day_id]) exByDay[e.workout_day_id] = []
    exByDay[e.workout_day_id].push(e)
  }

  return NextResponse.json({
    programId: (program as { id: string }).id,
    days: dayList.map((d) => ({ ...d, exercises: exByDay[d.id] ?? [] })),
  })
}
