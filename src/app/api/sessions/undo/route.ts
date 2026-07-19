import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { sessionId } = await request.json()
  if (typeof sessionId !== 'string' || !sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  // Fetch the session and verify ownership via join
  const { data: session } = await db
    .from('sessions')
    .select('id, programs!inner(user_id, id)')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const prog = session.programs as { user_id: string; id: string }
  if (prog.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // Enforce: only the most recent session can be undone
  const { data: latestSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('program_id', prog.id)
    .in('status', ['completed', 'partial'])
    .order('logged_at', { ascending: false })
    .limit(1)
    .single()

  if (!latestSession || (latestSession as { id: string }).id !== sessionId) {
    return NextResponse.json({ error: 'Only the most recent session can be undone' }, { status: 400 })
  }

  // All writes (weight-snapshot restore, child-table deletes, status flip,
  // friday_alt reversal) happen in one transaction — the mirror image of the
  // log_session RPC, so a mid-sequence failure can't leave weights restored
  // while the session still reads 'completed'.
  const { error: rpcError } = await db.rpc('undo_session', {
    payload: { sessionId },
  })
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
