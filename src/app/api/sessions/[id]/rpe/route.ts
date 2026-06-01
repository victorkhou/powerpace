import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user) return authError!

  const { id } = await params
  const body: { rpe?: number | null } = await request.json()
  const { rpe = null } = body

  if (rpe !== null && (typeof rpe !== 'number' || !Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
    return NextResponse.json({ error: 'rpe must be null or an integer 1-10' }, { status: 400 })
  }

  const { data: session } = await db
    .from('sessions')
    .select('id, status, programs!inner(user_id)')
    .eq('id', id)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const prog = session.programs as { user_id: string }
  if (prog.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (session.status !== 'completed' && session.status !== 'partial') {
    return NextResponse.json({ error: 'Session not editable' }, { status: 409 })
  }

  const { error: updateError } = await db.from('sessions').update({ rpe }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
