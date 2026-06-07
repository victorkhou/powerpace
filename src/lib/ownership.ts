import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase/server'
import type { Program } from '@/types/database'

type DbClient = Awaited<ReturnType<typeof createClient>>

/**
 * Fetches a program by id and verifies it belongs to `user`. Returns the
 * program on success, or a ready-to-return error response (404 if missing,
 * 403 if owned by someone else). Consolidates the fetch-then-check block that
 * the directly-program-scoped write routes share.
 */
export async function requireProgram(
  supabase: DbClient,
  user: User,
  programId: string
): Promise<{ program: Program } | { error: NextResponse }> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .maybeSingle()

  if (error) return { error: NextResponse.json({ error: 'Failed to load program' }, { status: 500 }) }
  const program = data as Program | null
  if (!program) return { error: NextResponse.json({ error: 'Program not found' }, { status: 404 }) }
  if (program.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }
  return { program }
}
