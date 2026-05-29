import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { sessionId } = await request.json()

  // Fetch the session and verify ownership via join
  const { data: session } = await db
    .from('sessions')
    .select('*, programs!inner(user_id, id)')
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

  // Restore working_weights from snapshot
  const snapshot = session.weight_snapshot as Record<string, number> | null
  if (snapshot) {
    for (const [key, weight] of Object.entries(snapshot)) {
      await db
        .from('working_weights')
        .update({ weight_lbs: weight, updated_at: new Date().toISOString() })
        .eq('program_id', prog.id)
        .eq('key', key)
    }
  }

  // Delete session_sets, run_logs, weight_history for this session
  await db.from('session_sets').delete().eq('session_id', sessionId)
  await db.from('run_logs').delete().eq('session_id', sessionId)
  await db.from('weight_history').delete().eq('session_id', sessionId)

  // Mark session as undone
  await db.from('sessions').update({ status: 'undone' }).eq('id', sessionId)

  return NextResponse.json({ ok: true })
}
