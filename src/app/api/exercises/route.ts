import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { validateExerciseFull, type ExerciseShape } from '@/lib/exercise-validation'

export async function POST(request: NextRequest) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user) return authError!

  const body: { workoutDayId: string; exercise: ExerciseShape } = await request.json()
  if (!body.workoutDayId || !body.exercise) {
    return NextResponse.json({ error: 'workoutDayId and exercise are required' }, { status: 400 })
  }

  const validation = validateExerciseFull(body.exercise)
  if (validation) return NextResponse.json({ error: validation }, { status: 400 })

  const { data: day } = await db
    .from('workout_days')
    .select('id, programs!inner(user_id)')
    .eq('id', body.workoutDayId)
    .single()

  if (!day) return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  const prog = day.programs as { user_id: string }
  if (prog.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data: created, error: insertError } = await db
    .from('exercises')
    .insert({ ...body.exercise, workout_day_id: body.workoutDayId })
    .select()
    .single()

  if (insertError || !created) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create exercise' }, { status: 500 })
  }

  return NextResponse.json({ exercise: created })
}
