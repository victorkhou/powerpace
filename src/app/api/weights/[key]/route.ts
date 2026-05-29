import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { recompute, AUTO_KEYS, PROGRESSABLE } from '@/lib/progression'
import type { WorkingWeight } from '@/types/database'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { user, supabase, db, error: authError } = await getAuthenticatedUser()
  if (authError || !user || !supabase) return authError!

  const { key } = await params
  const { programId, weightLbs } = await request.json()

  // Block manual edits to auto-derived weights
  if (AUTO_KEYS.has(key)) {
    return NextResponse.json({ error: 'Cannot edit auto-derived weight' }, { status: 400 })
  }

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('user_id', user.id)
    .single()

  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

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

  // If the edited key is an intensity parent of any auto-derived volume keys, recompute
  if (PROGRESSABLE.has(key)) {
    const { data: allWeightsRaw } = await supabase
      .from('working_weights')
      .select('*')
      .eq('program_id', programId)
    const allWeights = (allWeightsRaw ?? []) as WorkingWeight[]
    const map = Object.fromEntries(allWeights.map((w) => [w.key, w.weight_lbs]))
    map[key] = weightLbs
    const recomputed = recompute(map)
    for (const ak of AUTO_KEYS) {
      const newVal = recomputed[ak]
      const existing = allWeights.find((w) => w.key === ak)
      if (existing && newVal !== undefined && newVal !== existing.weight_lbs) {
        await db
          .from('working_weights')
          .update({ weight_lbs: newVal, updated_at: new Date().toISOString() })
          .eq('program_id', programId)
          .eq('key', ak)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
