import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireProgram } from '@/lib/ownership'
import { currentWeekOf } from '@/lib/week'

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user, supabase, db } = auth

  const { programId, workoutDayId, date } = await request.json()

  const owned = await requireProgram(supabase, user, programId)
  if ('error' in owned) return owned.error
  // Derived from the anchor + this date, not the client body (see log route).
  const week = currentWeekOf(owned.program, date)

  const { data: session, error } = await db
    .from('sessions')
    .upsert({
      program_id: programId,
      workout_day_id: workoutDayId,
      date,
      week_number: week.number,
      week_type: week.type,
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
