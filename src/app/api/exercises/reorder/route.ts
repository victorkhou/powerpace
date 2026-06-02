import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user) return authError!

  const body: { workoutDayId: string; orderedIds: string[] } = await request.json()
  if (!body.workoutDayId || !Array.isArray(body.orderedIds)) {
    return NextResponse.json({ error: 'workoutDayId and orderedIds[] are required' }, { status: 400 })
  }

  const { data: day } = await db
    .from('workout_days')
    .select('id, programs!inner(user_id)')
    .eq('id', body.workoutDayId)
    .single()

  if (!day) return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  const prog = day.programs as { user_id: string }
  if (prog.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data: existing } = await db
    .from('exercises')
    .select('id')
    .eq('workout_day_id', body.workoutDayId)

  const existingIds = new Set(((existing ?? []) as Array<{ id: string }>).map((e) => e.id))
  if (body.orderedIds.length !== existingIds.size || !body.orderedIds.every((id) => existingIds.has(id))) {
    return NextResponse.json(
      { error: 'orderedIds must contain exactly the exercise ids belonging to this workout day' },
      { status: 400 }
    )
  }

  for (let i = 0; i < body.orderedIds.length; i++) {
    const { error } = await db
      .from('exercises')
      .update({ sort_order: i })
      .eq('id', body.orderedIds[i])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
