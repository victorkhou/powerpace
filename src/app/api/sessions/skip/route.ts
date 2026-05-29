import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { programId, workoutDayId, date, weekNumber, weekType } = await request.json()

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('user_id', user.id)
    .single()

  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

  const { data: session, error } = await db
    .from('sessions')
    .upsert({
      program_id: programId,
      workout_day_id: workoutDayId,
      date,
      week_number: weekNumber,
      week_type: weekType,
      status: 'skipped',
    }, { onConflict: 'program_id,date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessionId: session.id })
}
