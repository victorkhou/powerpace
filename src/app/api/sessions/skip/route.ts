import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireProgram } from '@/lib/ownership'

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user, supabase, db } = auth

  const { programId, workoutDayId, date, weekNumber, weekType } = await request.json()

  const owned = await requireProgram(supabase, user, programId)
  if ('error' in owned) return owned.error

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
