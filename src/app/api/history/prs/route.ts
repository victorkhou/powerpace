import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { PROGRESSABLE } from '@/lib/progression'

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

  const { data: weightsRaw } = await supabase
    .from('working_weights')
    .select('key, pr_lbs, streak, failures')
    .eq('program_id', program.id)

  const weights = (weightsRaw ?? []) as Array<{ key: string; pr_lbs: number | null; streak: number; failures: number }>

  const prs = weights
    .filter((w) => PROGRESSABLE.has(w.key) && w.pr_lbs != null && w.pr_lbs > 0)
    .map((w) => ({
      key: w.key,
      pr_lbs: w.pr_lbs!,
      streak: w.streak,
      failures: w.failures,
    }))
    .sort((a, b) => b.pr_lbs - a.pr_lbs)

  return NextResponse.json(prs)
}
