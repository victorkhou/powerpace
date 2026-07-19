import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireWorkoutDay } from '@/lib/ownership'
import type { Database } from '@/types/database'

type WorkoutDayUpdate = Database['public']['Tables']['workout_days']['Update']

const DAY_TYPES = new Set(['lift', 'run', 'combo', 'rest'])
const WEEK_TYPES = new Set(['A', 'B', 'both'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !db) return authError!

  const { id } = await params
  const body: {
    name?: string
    tag?: string | null
    type?: 'lift' | 'run' | 'combo' | 'rest'
    is_volume?: boolean
    week_type?: 'A' | 'B' | 'both'
    variant?: string | null
  } = await request.json()

  const update: WorkoutDayUpdate = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
    }
    update.name = body.name.trim()
  }
  if (body.tag !== undefined) {
    if (body.tag !== null && typeof body.tag !== 'string') {
      return NextResponse.json({ error: 'tag must be a string or null' }, { status: 400 })
    }
    update.tag = body.tag
  }
  if (body.type !== undefined) {
    if (!DAY_TYPES.has(body.type)) {
      return NextResponse.json({ error: `type must be one of: ${[...DAY_TYPES].join(', ')}` }, { status: 400 })
    }
    update.type = body.type
  }
  if (body.is_volume !== undefined) {
    if (typeof body.is_volume !== 'boolean') {
      return NextResponse.json({ error: 'is_volume must be a boolean' }, { status: 400 })
    }
    update.is_volume = body.is_volume
  }
  if (body.week_type !== undefined) {
    if (!WEEK_TYPES.has(body.week_type)) {
      return NextResponse.json({ error: `week_type must be one of: ${[...WEEK_TYPES].join(', ')}` }, { status: 400 })
    }
    update.week_type = body.week_type
  }
  if (body.variant !== undefined) {
    if (body.variant !== null && body.variant !== 'A1' && body.variant !== 'A2') {
      return NextResponse.json({ error: 'variant must be A1, A2, or null' }, { status: 400 })
    }
    update.variant = body.variant
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const owned = await requireWorkoutDay(db, user, id)
  if ('error' in owned) return owned.error

  const { error: updateError } = await db
    .from('workout_days')
    .update(update)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
