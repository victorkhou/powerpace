import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function GET() {
  const { user, supabase, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single<{ id: string }>()

  if (!program) return NextResponse.json([])

  const { data: sessions } = await supabase
    .from('sessions')
    .select('date, week_number, volume_lbs, status')
    .eq('program_id', program.id)
    .neq('status', 'undone')
    .neq('status', 'skipped')
    .order('date', { ascending: true })

  if (!sessions) return NextResponse.json([])

  return NextResponse.json(
    (sessions as Array<{ date: string; week_number: number; volume_lbs: number | null; status: string }>).map((s) => ({
      date: s.date,
      week: s.week_number,
      volume: s.volume_lbs ?? 0,
    }))
  )
}
