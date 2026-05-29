import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function PATCH(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { programId, weekNumber, weekType } = await request.json()

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('user_id', user.id)
    .single<{ id: string }>()

  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (weekNumber !== undefined) updates.week_number = weekNumber
  if (weekType !== undefined) updates.week_type = weekType

  if (Object.keys(updates).length > 0) {
    await db.from('programs').update(updates).eq('id', programId)
  }

  return NextResponse.json({ ok: true })
}
