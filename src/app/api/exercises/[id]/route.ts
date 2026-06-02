import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { validateExercise, validateExerciseFull, type ExerciseShape } from '@/lib/exercise-validation'

const ALLOWED_FIELDS: Array<keyof ExerciseShape> = [
  'name',
  'sets',
  'reps',
  'weight_key',
  'progression_type',
  'increment_lbs',
  'is_auto_volume',
  'parent_key',
  'is_run',
  'sort_order',
]

async function loadExerciseWithOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  id: string
): Promise<{ row: ExerciseShape & { id: string; workout_day_id: string }; ownerId: string } | null> {
  const { data } = await db
    .from('exercises')
    .select('*, workout_days!inner(programs!inner(user_id))')
    .eq('id', id)
    .single()
  if (!data) return null
  const ownerId = data.workout_days?.programs?.user_id as string | undefined
  if (!ownerId) return null
  const { workout_days, ...rest } = data
  void workout_days
  return { row: rest, ownerId }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user) return authError!

  const { id } = await params
  const body: Partial<ExerciseShape> = await request.json()

  const update: Partial<ExerciseShape> = {}
  for (const k of ALLOWED_FIELDS) {
    if (k in body) (update as Record<string, unknown>)[k] = body[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const partial = validateExercise(update)
  if (partial) return NextResponse.json({ error: partial }, { status: 400 })

  const loaded = await loadExerciseWithOwner(db, id)
  if (!loaded) return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  if (loaded.ownerId !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const merged: ExerciseShape = { ...loaded.row, ...update }
  const fullErr = validateExerciseFull(merged)
  if (fullErr) return NextResponse.json({ error: fullErr }, { status: 400 })

  const { error: updateError } = await db
    .from('exercises')
    .update(update)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user) return authError!

  const { id } = await params

  const loaded = await loadExerciseWithOwner(db, id)
  if (!loaded) return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  if (loaded.ownerId !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { error: deleteError } = await db.from('exercises').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
