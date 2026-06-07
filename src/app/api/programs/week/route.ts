import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import type { Database } from '@/types/database'

type ProgramUpdate = Database['public']['Tables']['programs']['Update']

export async function PATCH(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { programId, weekNumber, weekType } = await request.json()

  if (weekType !== undefined && weekType !== 'A' && weekType !== 'B') {
    return NextResponse.json({ error: 'weekType must be A or B' }, { status: 400 })
  }
  if (weekNumber !== undefined && (!Number.isInteger(weekNumber) || weekNumber < 1)) {
    return NextResponse.json({ error: 'weekNumber must be a positive integer' }, { status: 400 })
  }

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('user_id', user.id)
    .single<{ id: string }>()

  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  const updates: ProgramUpdate = {}
  if (weekNumber !== undefined) updates.week_number = weekNumber
  if (weekType !== undefined) updates.week_type = weekType

  if (Object.keys(updates).length > 0) {
    await db.from('programs').update(updates).eq('id', programId)
  }

  return NextResponse.json({ ok: true })
}
