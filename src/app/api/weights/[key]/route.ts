import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { diffAutoWeights, AUTO_KEYS, PROGRESSABLE } from '@/lib/progression'
import { requireProgram } from '@/lib/ownership'
import type { WorkingWeight } from '@/types/database'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user, supabase, db } = auth

  const { key } = await params
  const { programId, weightLbs } = await request.json()

  // Block manual edits to auto-derived weights
  if (AUTO_KEYS.has(key)) {
    return NextResponse.json({ error: 'Cannot edit auto-derived weight' }, { status: 400 })
  }

  const owned = await requireProgram(supabase, user, programId)
  if ('error' in owned) return owned.error
  const { program } = owned

  const { data: wwRaw } = await supabase
    .from('working_weights')
    .select('weight_lbs')
    .eq('program_id', programId)
    .eq('key', key)
    .single<{ weight_lbs: number }>()

  if (!wwRaw) return NextResponse.json({ error: 'Weight key not found' }, { status: 404 })

  await db
    .from('working_weights')
    .update({ weight_lbs: weightLbs, updated_at: new Date().toISOString() })
    .eq('program_id', programId)
    .eq('key', key)

  await db.from('weight_history').insert({
    program_id: programId,
    weight_key: key,
    weight_before: wwRaw.weight_lbs,
    weight_after: weightLbs,
    change_reason: 'manual',
    failures_at_change: 0,
  })

  // If the edited key is an intensity parent of any auto-derived volume keys,
  // recompute. A failed read here is a 500 (previously it silently coalesced to
  // [] and skipped recomputation while still returning ok:true).
  if (PROGRESSABLE.has(key)) {
    const { data: allWeightsRaw, error: readError } = await supabase
      .from('working_weights')
      .select('*')
      .eq('program_id', programId)
    if (readError) return NextResponse.json({ error: 'Failed to load weights' }, { status: 500 })

    const changed = diffAutoWeights((allWeightsRaw ?? []) as WorkingWeight[], program.volume_pct, { [key]: weightLbs })
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
