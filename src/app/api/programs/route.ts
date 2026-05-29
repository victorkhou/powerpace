import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { seedProgram } from '@/lib/seed'

export async function POST() {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  try {
    await db.from('programs').update({ is_active: false }).eq('user_id', user.id)
    const programId = await seedProgram(supabase, user.id)
    return NextResponse.json({ programId })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
