import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { SEED_DAYS } from '@/lib/seed'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user) return authError!

  const { id } = await params

  const { data: day } = await db
    .from('workout_days')
    .select('id, day_of_week, week_type, variant, programs!inner(user_id)')
    .eq('id', id)
    .single()

  if (!day) return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  const prog = day.programs as { user_id: string }
  if (prog.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const seed = SEED_DAYS.find(
    (s) =>
      s.day_of_week === day.day_of_week &&
      s.week_type === day.week_type &&
      (s.variant ?? null) === (day.variant ?? null)
  )
  if (!seed) {
    return NextResponse.json(
      { error: 'No seed template matches this day (day_of_week, week_type, variant)' },
      { status: 404 }
    )
  }

  await db.from('workout_days').update({
    name: seed.name,
    type: seed.type,
    tag: seed.tag,
    is_volume: seed.is_volume,
  }).eq('id', id)

  await db.from('exercises').delete().eq('workout_day_id', id)

  if (seed.exercises.length > 0) {
    const { error: insertError } = await db.from('exercises').insert(
      seed.exercises.map((e) => ({ ...e, workout_day_id: id }))
    )
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
