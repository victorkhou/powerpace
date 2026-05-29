import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      user: null,
      supabase: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: null as any,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return {
    user,
    supabase,
    // Untyped alias for insert/update operations that trigger TS strict type errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: supabase as any,
    error: null,
  }
}
