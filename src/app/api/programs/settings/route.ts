import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import type { Database } from '@/types/database'

type ProgramUpdate = Database['public']['Tables']['programs']['Update']

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user, supabase, db } = auth

  const { programId, currentWeek, deloadWeek } = await request.json()

  if (currentWeek !== undefined && (!Number.isInteger(currentWeek) || currentWeek < 1)) {
    return NextResponse.json({ error: 'currentWeek must be a positive integer' }, { status: 400 })
  }
  if (deloadWeek !== undefined && deloadWeek !== null && (!Number.isInteger(deloadWeek) || deloadWeek < 1)) {
    return NextResponse.json({ error: 'deloadWeek must be null or a positive integer' }, { status: 400 })
  }

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('user_id', user.id)
    .single<{ id: string }>()

  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  const updates: ProgramUpdate = {}
  if (currentWeek !== undefined) updates.current_week = currentWeek
  if (deloadWeek !== undefined) updates.deload_week = deloadWeek

  if (Object.keys(updates).length > 0) {
    await db.from('programs').update(updates).eq('id', programId)
  }

  return NextResponse.json({ ok: true })
}
