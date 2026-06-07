import type { Program, WorkoutDay } from '@/types/database'

/**
 * Picks the workout_day that naturally falls on a given day-of-week for the
 * program's current week_type + friday_alt. Mirrors the matching the seed uses:
 * week_type 'both' always applies; variant days (Tue/Fri Week A) resolve via
 * friday_alt. Returns null on a day with no matching template (shouldn't happen
 * for a fully-seeded program, but callers must handle it).
 */
export function matchNaturalWorkout(
  days: WorkoutDay[],
  dayOfWeek: number,
  program: Pick<Program, 'week_type' | 'friday_alt'>
): WorkoutDay | null {
  const candidates = days.filter((d) => d.day_of_week === dayOfWeek)
  let match: WorkoutDay | null = null
  for (const d of candidates) {
    if (d.week_type !== 'both' && d.week_type !== program.week_type) continue
    if (d.variant !== null) {
      if (d.variant === program.friday_alt) return d
    } else {
      match = d
    }
  }
  return match
}

/**
 * Resolves the workout that should display on a specific calendar date,
 * applying a per-date override if one exists. The override wins outright —
 * it points directly at a workout_day_id regardless of day_of_week.
 */
export function resolveWorkoutForDate(
  days: WorkoutDay[],
  dayOfWeek: number,
  program: Pick<Program, 'week_type' | 'friday_alt'>,
  overrideWorkoutDayId: string | null
): WorkoutDay | null {
  if (overrideWorkoutDayId) {
    const overridden = days.find((d) => d.id === overrideWorkoutDayId)
    if (overridden) return overridden
  }
  return matchNaturalWorkout(days, dayOfWeek, program)
}
