import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { programId, workoutDayId, date, weekNumber, weekType } = await request.json()

  const { data: program } = await supabase
    .from('programs')
    .select('id, user_id')
    .eq('id', programId)
    .single<{ id: string; user_id: string }>()

  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
  if (program.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data: session, error } = await db
    .from('sessions')
    .upsert({
      program_id: programId,
      workout_day_id: workoutDayId,
      date,
      week_number: weekNumber,
      week_type: weekType,
      status: 'skipped',
      rpe: null,
      notes: null,
      volume_lbs: 0,
      weight_snapshot: {},
    }, { onConflict: 'program_id,date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessionId: session.id })
}
