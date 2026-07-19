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

  const { data: history } = await supabase
    .from('weight_history')
    .select('weight_key, weight_after, change_reason, created_at')
    .eq('program_id', program.id)
    .order('created_at', { ascending: true })

  if (!history) return NextResponse.json([])

  return NextResponse.json(
    (history as Array<{ weight_key: string; weight_after: number; change_reason: string; created_at: string }>).map((h) => ({
      key: h.weight_key,
      weight: h.weight_after,
      reason: h.change_reason,
      date: h.created_at,
    }))
  )
}
