import { localDateKey, startOfWeekKey } from '@/lib/date'
import type { WeekType } from '@/types/database'

/**
 * Derives the current program week from the calendar instead of storing a
 * pointer the user has to bump by hand.
 *
 * Previously `programs.week_number` / `week_type` were plain columns edited in
 * Settings, so a program created in June still read "week 1 / A" in August. Now
 * an ANCHOR is stored — "on this Monday, the program was week N of type T" —
 * and the current week is computed from how many Monday-anchored weeks have
 * elapsed since. Correcting the week rewrites the anchor, so it keeps advancing
 * from the corrected point.
 *
 * Monday-anchored to match startOfWeekKey() and the schedule's week window, so
 * a session logged Sunday night and one logged Monday morning fall in different
 * weeks exactly as the schedule shows them.
 */

/** Whole weeks between two Monday keys. Negative if `to` precedes `from`. */
export function weeksBetween(fromMondayKey: string, toMondayKey: string): number {
  const [fy, fm, fd] = fromMondayKey.split('-').map(Number)
  const [ty, tm, td] = toMondayKey.split('-').map(Number)
  // Compare at UTC noon so DST transitions can't shift the difference across a
  // day boundary (a 23- or 25-hour local day would otherwise round wrong).
  const from = Date.UTC(fy, fm - 1, fd, 12)
  const to = Date.UTC(ty, tm - 1, td, 12)
  return Math.round((to - from) / (7 * 24 * 60 * 60 * 1000))
}

export type WeekAnchor = {
  /** A Monday (YYYY-MM-DD) on which the program was at the values below. */
  date: string
  number: number
  type: WeekType
}

/**
 * The program's week for a given date (defaults to today).
 *
 * Weeks before the anchor clamp to the anchor's values rather than going
 * negative — a session back-dated before the program started should read as
 * week 1, not week -2.
 */
export function deriveWeek(anchor: WeekAnchor, on: Date = new Date()): { number: number; type: WeekType } {
  const elapsed = weeksBetween(anchor.date, startOfWeekKey(on))
  if (elapsed <= 0) return { number: anchor.number, type: anchor.type }

  const number = anchor.number + elapsed
  // A/B alternates every week: same parity as the anchor keeps the anchor type.
  const flipped = elapsed % 2 === 1
  const type: WeekType = flipped ? (anchor.type === 'A' ? 'B' : 'A') : anchor.type
  return { number, type }
}

/**
 * Builds the anchor to store when the user corrects the current week: "this
 * week (the Monday containing `on`) is week N of type T".
 */
export function anchorForCorrection(
  number: number,
  type: WeekType,
  on: Date = new Date()
): WeekAnchor {
  return { date: startOfWeekKey(on), number, type }
}

/** The Monday of the week containing `on`, as a date key. */
export function currentWeekStart(on: Date = new Date()): string {
  return startOfWeekKey(on)
}

/** The anchor columns as stored on `programs` (nullable pre-backfill). */
type AnchorColumns = {
  week_anchor_date: string | null
  week_anchor_number: number | null
  week_anchor_type: string | null
  week_number: number
  week_type: string
  created_at: string
}

/**
 * Reads a program's anchor, falling back to the legacy columns if the anchor is
 * somehow unset (a row inserted before the backfill, or by a client that doesn't
 * know the new columns). Falling back to created_at rather than "today" matters:
 * anchoring an old program to today would reset it to week 1 forever.
 */
export function anchorOf(program: AnchorColumns): WeekAnchor {
  const type = (program.week_anchor_type ?? program.week_type ?? 'A') as WeekType
  const number = program.week_anchor_number ?? program.week_number ?? 1
  const date = program.week_anchor_date ?? startOfWeekKey(new Date(program.created_at))
  return { date, number, type: type === 'B' ? 'B' : 'A' }
}

/**
 * The program's current week, derived. `onDateKey` is the caller's LOCAL date
 * (the client sends it) so the week rolls over on the user's Monday, not UTC's.
 */
export function currentWeekOf(program: AnchorColumns, onDateKey?: string | null): { number: number; type: WeekType } {
  const on = onDateKey ? new Date(`${onDateKey}T12:00:00`) : new Date()
  return deriveWeek(anchorOf(program), on)
}

/** Today's local date key — re-exported so callers need one import. */
export { localDateKey }
