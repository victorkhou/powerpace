import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireSession } from '@/lib/ownership'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !db) return authError!

  const { id } = await params
  const body: { rpe?: number | null } = await request.json()
  const { rpe = null } = body

  if (rpe !== null && (typeof rpe !== 'number' || !Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
    return NextResponse.json({ error: 'rpe must be null or an integer 1-10' }, { status: 400 })
  }

  const owned = await requireSession(db, user, id)
  if ('error' in owned) return owned.error
  if (owned.session.status !== 'completed' && owned.session.status !== 'partial') {
    return NextResponse.json({ error: 'Session not editable' }, { status: 409 })
  }

  const { error: updateError } = await db.from('sessions').update({ rpe }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
