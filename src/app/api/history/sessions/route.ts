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
    .select('id, date, week_number, week_type, friday_alt, status, notes, volume_lbs, workout_day_id')
    .eq('program_id', program.id)
    .neq('status', 'undone')
    .order('date', { ascending: false })
    .limit(50)

  if (!sessions || sessions.length === 0) return NextResponse.json([])

  const dayIds = [...new Set((sessions as Array<{ workout_day_id: string }>).map((s) => s.workout_day_id))]
  const { data: days } = await supabase
    .from('workout_days')
    .select('id, name, type, tag')
    .in('id', dayIds)

  const dayMap = Object.fromEntries(
    ((days ?? []) as Array<{ id: string; name: string; type: string; tag: string | null }>).map((d) => [d.id, d])
  )

  const result = (sessions as Array<{ id: string; date: string; week_number: number; week_type: string; friday_alt: string | null; status: string; notes: string | null; volume_lbs: number | null; workout_day_id: string }>).map((s) => ({
    id: s.id,
    date: s.date,
    week: s.week_number,
    week_type: s.week_type,
    friday_alt: s.friday_alt,
    status: s.status,
    notes: s.notes,
    volume_lbs: s.volume_lbs,
    workout_day: dayMap[s.workout_day_id] ?? null,
  }))

  return NextResponse.json(result)
}
