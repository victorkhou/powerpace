import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { id } = await params

  const { data: sets } = await supabase
    .from('session_sets')
    .select('exercise_id, set_number, completed, weight_lbs, reps_target, reps_actual')
    .eq('session_id', id)
    .order('set_number', { ascending: true })

  if (!sets || sets.length === 0) return NextResponse.json([])

  const exerciseIds = [...new Set(sets.map((s: { exercise_id: string }) => s.exercise_id))]
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, weight_key')
    .in('id', exerciseIds)

  const exerciseMap = Object.fromEntries(
    ((exercises ?? []) as Array<{ id: string; name: string; weight_key: string | null }>).map((e) => [e.id, e])
  )

  type SetRow = { exercise_id: string; set_number: number; completed: boolean; weight_lbs: number | null; reps_target: number; reps_actual: number | null }

  const grouped: Record<string, { name: string; weight_key: string | null; sets: Array<{ set: number; completed: boolean; weight_lbs: number | null; reps_target: number; reps_actual: number | null }> }> = {}

  for (const s of sets as SetRow[]) {
    const ex = exerciseMap[s.exercise_id]
    if (!grouped[s.exercise_id]) {
      grouped[s.exercise_id] = {
        name: ex?.name ?? 'Unknown',
        weight_key: ex?.weight_key ?? null,
        sets: [],
      }
    }
    grouped[s.exercise_id].sets.push({
      set: s.set_number,
      completed: s.completed,
      weight_lbs: s.weight_lbs,
      reps_target: s.reps_target,
      reps_actual: s.reps_actual,
    })
  }

  return NextResponse.json(Object.values(grouped))
}
