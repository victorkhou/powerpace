import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireProgram } from '@/lib/ownership'
import { isDateKey } from '@/lib/date'
import { anchorForCorrection, currentWeekOf } from '@/lib/week'
import type { Database } from '@/types/database'

type ProgramUpdate = Database['public']['Tables']['programs']['Update']

/**
 * Corrects the current program week.
 *
 * The week is derived from an anchor (see src/lib/week.ts), not stored directly,
 * so a correction rewrites the anchor to "this week is N of type T" — and the
 * week then keeps auto-advancing from the corrected point. Writing week_number /
 * week_type alone would be silently undone by the next derivation.
 *
 * Partial corrections are supported: omitting weekNumber or weekType keeps the
 * currently derived value for that field.
 *
 * `today` is the caller's LOCAL date key, so "this week" means their Monday
 * rather than the server's.
 */
export async function PATCH(request: NextRequest) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { programId, weekNumber, weekType, today } = await request.json()

  if (weekType !== undefined && weekType !== 'A' && weekType !== 'B') {
    return NextResponse.json({ error: 'weekType must be A or B' }, { status: 400 })
  }
  if (weekNumber !== undefined && (!Number.isInteger(weekNumber) || weekNumber < 1)) {
    return NextResponse.json({ error: 'weekNumber must be a positive integer' }, { status: 400 })
  }
  if (today !== undefined && !isDateKey(today)) {
    return NextResponse.json({ error: 'today must be YYYY-MM-DD' }, { status: 400 })
  }
  if (weekNumber === undefined && weekType === undefined) {
    return NextResponse.json({ error: 'weekNumber or weekType is required' }, { status: 400 })
  }

  const owned = await requireProgram(supabase, user, programId)
  if ('error' in owned) return owned.error
  const { program } = owned

  const localDate: string | null = today ?? null
  // Start from what's currently derived so a partial correction leaves the other
  // field where it already is.
  const derived = currentWeekOf(program, localDate)
  const nextNumber = weekNumber ?? derived.number
  const nextType: 'A' | 'B' = weekType ?? derived.type

  const on = localDate ? new Date(`${localDate}T12:00:00`) : new Date()
  const anchor = anchorForCorrection(nextNumber, nextType, on)

  const updates: ProgramUpdate = {
    week_anchor_date: anchor.date,
    week_anchor_number: anchor.number,
    week_anchor_type: anchor.type,
    // Keep the legacy columns in step as a cache, so anything still reading them
    // (and the Settings display before a refresh) doesn't show a stale week.
    week_number: anchor.number,
    week_type: anchor.type,
    current_week: anchor.number,
  }

  const { error: updateError } = await db.from('programs').update(updates).eq('id', programId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, weekNumber: anchor.number, weekType: anchor.type })
}
