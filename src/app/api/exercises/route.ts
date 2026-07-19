import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireWorkoutDay } from '@/lib/ownership'
import { validateExerciseFull, type ExerciseShape } from '@/lib/exercise-validation'

export async function POST(request: NextRequest) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !db) return authError!

  const body: { workoutDayId: string; exercise: ExerciseShape } = await request.json()
  if (!body.workoutDayId || !body.exercise) {
    return NextResponse.json({ error: 'workoutDayId and exercise are required' }, { status: 400 })
  }

  const validation = validateExerciseFull(body.exercise)
  if (validation) return NextResponse.json({ error: validation }, { status: 400 })

  const owned = await requireWorkoutDay(db, user, body.workoutDayId)
  if ('error' in owned) return owned.error

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
