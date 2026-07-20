import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireWorkoutDay } from '@/lib/ownership'

export async function POST(request: NextRequest) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !db) return authError!

  const body: { workoutDayId: string; orderedIds: string[] } = await request.json()
  if (!body.workoutDayId || !Array.isArray(body.orderedIds)) {
    return NextResponse.json({ error: 'workoutDayId and orderedIds[] are required' }, { status: 400 })
  }

  const owned = await requireWorkoutDay(db, user, body.workoutDayId)
  if ('error' in owned) return owned.error

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

  // Batch all updates concurrently (was a sequential per-exercise loop — N round
  // trips for N exercises). PostgREST handles these as individual updates; an RPC
  // with unnest() would be one round trip, but this is sufficient for ≤12 exercises.
  const results = await Promise.all(
    body.orderedIds.map((id, i) =>
      db.from('exercises').update({ sort_order: i }).eq('id', id)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
