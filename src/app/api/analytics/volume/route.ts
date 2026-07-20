import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getActiveProgram } from '@/lib/ownership'

export async function GET() {
  const { user, supabase, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const res = await getActiveProgram(supabase, user)
  if ('error' in res) return res.error
  const { program } = res
  if (!program) return NextResponse.json([])

  // Cap to the most recent 200 sessions (enough for ~6 months of 4×/week
  // training). Without a limit this grows unbounded with the program's lifetime.
  const { data: sessions } = await supabase
    .from('sessions')
    .select('date, week_number, volume_lbs, status')
    .eq('program_id', program.id)
    .neq('status', 'undone')
    .neq('status', 'skipped')
    .order('date', { ascending: false })
    .limit(200)

  if (!sessions) return NextResponse.json([])

  // Fetched DESC (newest first) for the limit; reverse to oldest→newest for the chart.
  return NextResponse.json(
    (sessions as Array<{ date: string; week_number: number; volume_lbs: number | null; status: string }>)
      .reverse()
      .map((s) => ({
        date: s.date,
        week: s.week_number,
        volume: s.volume_lbs ?? 0,
      }))
  )
}
