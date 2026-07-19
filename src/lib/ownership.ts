import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase/server'
import type { Program, Session, WorkoutDay } from '@/types/database'

export type DbClient = Awaited<ReturnType<typeof createClient>>

function err(message: string, status: number): { error: NextResponse } {
  return { error: NextResponse.json({ error: message }, { status }) }
}

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

  if (error) return err('Failed to load program', 500)
  const program = data as Program | null
  if (!program) return err('Program not found', 404)
  if (program.user_id !== user.id) return err('Unauthorized', 403)
  return { program }
}

/**
 * Fetches the user's single active program. Nine routes previously copy-pasted
 * this query with drifting semantics; this is the one definition. Routes that
 * legitimately return an empty payload when no program exists (history,
 * analytics) get `program: null` back and map it themselves; routes that
 * require one pass `required: true` and receive a ready 404.
 */
export async function getActiveProgram(
  supabase: DbClient,
  user: User
): Promise<{ program: Program | null } | { error: NextResponse }> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return err('Failed to load program', 500)
  return { program: (data as Program | null) ?? null }
}

export async function requireActiveProgram(
  supabase: DbClient,
  user: User
): Promise<{ program: Program } | { error: NextResponse }> {
  const res = await getActiveProgram(supabase, user)
  if ('error' in res) return res
  if (!res.program) return err('No active program', 404)
  return { program: res.program }
}

/**
 * Fetches a workout day by id and verifies ownership via the programs join.
 * Uses maybeSingle + a distinct 500 branch (like requireProgram) so DB failures
 * don't masquerade as 404s — a drift the hand-rolled copies all had.
 */
export async function requireWorkoutDay(
  supabase: DbClient,
  user: User,
  workoutDayId: string
): Promise<{ day: WorkoutDay } | { error: NextResponse }> {
  const { data, error } = await supabase
    .from('workout_days')
    .select('*, programs!inner(user_id)')
    .eq('id', workoutDayId)
    .maybeSingle()

  if (error) return err('Failed to load workout day', 500)
  if (!data) return err('Workout day not found', 404)
  const owner = (data.programs as { user_id: string }).user_id
  if (owner !== user.id) return err('Unauthorized', 403)
  const { programs: _programs, ...day } = data as WorkoutDay & { programs: unknown }
  void _programs
  return { day: day as WorkoutDay }
}

/**
 * Fetches a session by id and verifies ownership via the programs join.
 */
export async function requireSession(
  supabase: DbClient,
  user: User,
  sessionId: string
): Promise<{ session: Session } | { error: NextResponse }> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, programs!inner(user_id)')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) return err('Failed to load session', 500)
  if (!data) return err('Session not found', 404)
  const owner = (data.programs as { user_id: string }).user_id
  if (owner !== user.id) return err('Unauthorized', 403)
  const { programs: _programs, ...session } = data as Session & { programs: unknown }
  void _programs
  return { session: session as Session }
}

/**
 * Fetches an exercise by id and verifies ownership through the
 * workout_days → programs join chain. Replaces the private
 * loadExerciseWithOwner helper that lived in exercises/[id]/route.ts with an
 * eslint-disabled `any` client param.
 */
export async function requireExercise(
  supabase: DbClient,
  user: User,
  exerciseId: string
): Promise<{ exercise: Record<string, unknown> & { id: string; workout_day_id: string } } | { error: NextResponse }> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*, workout_days!inner(programs!inner(user_id))')
    .eq('id', exerciseId)
    .maybeSingle()

  if (error) return err('Failed to load exercise', 500)
  if (!data) return err('Exercise not found', 404)
  const owner = (data.workout_days as { programs: { user_id: string } })?.programs?.user_id
  if (!owner) return err('Exercise not found', 404)
  if (owner !== user.id) return err('Unauthorized', 403)
  const { workout_days: _wd, ...exercise } = data as { workout_days: unknown; id: string; workout_day_id: string }
  void _wd
  return { exercise: exercise as Record<string, unknown> & { id: string; workout_day_id: string } }
}
