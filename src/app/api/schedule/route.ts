import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getActiveProgram } from '@/lib/ownership'
import type { WorkoutDay, Exercise } from '@/types/database'

export async function GET() {
  const { user, supabase, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const res = await getActiveProgram(supabase, user)
  if ('error' in res) return res.error
  const { program } = res
  if (!program) return NextResponse.json({ days: [] })

  const { data: daysRaw } = await supabase
    .from('workout_days')
    .select('*')
    .eq('program_id', program.id)

  const days = (daysRaw ?? []) as WorkoutDay[]

  const { data: exRaw } = await supabase
    .from('exercises')
    .select('*')
    .in('workout_day_id', days.map((d) => d.id))
    .order('sort_order')

  const exercises = (exRaw ?? []) as Exercise[]
  const exByDay: Record<string, Exercise[]> = {}
  for (const ex of exercises) {
    if (!exByDay[ex.workout_day_id]) exByDay[ex.workout_day_id] = []
    exByDay[ex.workout_day_id].push(ex)
  }

  return NextResponse.json({
    days: days.map((d) => ({ ...d, exercises: exByDay[d.id] ?? [] })),
  })
}
