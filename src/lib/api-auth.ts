import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

type DbClient = Awaited<ReturnType<typeof createClient>>

type AuthSuccess = { user: User; supabase: DbClient; db: DbClient; error: null }
type AuthFailure = { user: null; supabase: null; db: null; error: NextResponse }

export async function getAuthenticatedUser(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      user: null,
      supabase: null,
      db: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  // `db` is the same fully-typed client; the alias is kept so existing call
  // sites that distinguish read (`supabase`) from write (`db`) keep compiling.
  return { user, supabase, db: supabase, error: null }
}
