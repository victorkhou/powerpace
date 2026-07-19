import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireProgram } from '@/lib/ownership'
import { diffAutoWeights } from '@/lib/progression'
import type { Database, WorkingWeight } from '@/types/database'

type ProgramUpdate = Database['public']['Tables']['programs']['Update']

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user, supabase, db } = auth

  const { programId, currentWeek, deloadWeek, volumePct } = await request.json()

  if (currentWeek !== undefined && (!Number.isInteger(currentWeek) || currentWeek < 1)) {
    return NextResponse.json({ error: 'currentWeek must be a positive integer' }, { status: 400 })
  }
  if (deloadWeek !== undefined && deloadWeek !== null && (!Number.isInteger(deloadWeek) || deloadWeek < 1)) {
    return NextResponse.json({ error: 'deloadWeek must be null or a positive integer' }, { status: 400 })
  }
  if (volumePct !== undefined && (typeof volumePct !== 'number' || !Number.isFinite(volumePct) || volumePct <= 0 || volumePct > 1)) {
    return NextResponse.json({ error: 'volumePct must be a number in (0, 1]' }, { status: 400 })
  }

  const owned = await requireProgram(supabase, user, programId)
  if ('error' in owned) return owned.error

  const updates: ProgramUpdate = {}
  if (currentWeek !== undefined) updates.current_week = currentWeek
  if (deloadWeek !== undefined) updates.deload_week = deloadWeek
  if (volumePct !== undefined) updates.volume_pct = volumePct

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await db.from('programs').update(updates).eq('id', programId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Changing the multiplier recomputes every auto-derived volume weight from its
  // intensity parent immediately, so displayed weights always match the setting.
  if (volumePct !== undefined) {
    const { data: allWeightsRaw, error: readError } = await supabase
      .from('working_weights')
      .select('*')
      .eq('program_id', programId)
    if (readError) return NextResponse.json({ error: 'Failed to load weights' }, { status: 500 })

    const changed = diffAutoWeights((allWeightsRaw ?? []) as WorkingWeight[], volumePct)
    const now = new Date().toISOString()
    const results = await Promise.all(
      changed.map((c) =>
        db.from('working_weights')
          .update({ weight_lbs: c.weight_lbs, updated_at: now })
          .eq('program_id', programId)
          .eq('key', c.key)
      )
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
