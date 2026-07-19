import type { Exercise } from '@/types/database'

export const INCREMENTS: Record<string, number> = {
  squat: 5,
  rdl: 2.5,
  goodMornings: 2.5,
  bench: 5,
  incline: 5,
  ohp: 5,
  cgbp: 2.5,
  row: 5,
  deadlift: 5,
}

export const PROGRESSABLE = new Set(Object.keys(INCREMENTS))

export const AUTO_KEYS = new Set(['squatVol', 'benchVol', 'inclineVol', 'ohpVol', 'rowVol'])

// Maps each auto-derived key to the intensity key it derives from
export const AUTO_PARENT: Record<string, string> = {
  squatVol: 'squat',
  benchVol: 'bench',
  inclineVol: 'incline',
  ohpVol: 'ohp',
  rowVol: 'row',
}

// Round step per auto key (matches parent's increment)
const AUTO_STEP: Record<string, number> = {
  squatVol: 5,
  benchVol: 2.5,
  inclineVol: 2.5,
  ohpVol: 2.5,
  rowVol: 5,
}

// Default volume multiplier (Texas Method). Programs can override via volume_pct.
export const DEFAULT_VOLUME_PCT = 0.875

/** Renders a stored fraction (0.875) as a trimmed percentage string ("87.5%"). */
export function formatVolumePct(volumePct: number = DEFAULT_VOLUME_PCT): string {
  return `${(Math.round(volumePct * 1000) / 10)}%`
}

export function recompute(w: Record<string, number>, volumePct: number = DEFAULT_VOLUME_PCT): Record<string, number> {
  const out = { ...w }
  for (const [volKey, parentKey] of Object.entries(AUTO_PARENT)) {
    if (w[parentKey] != null) out[volKey] = autoVolumeFor(parentKey, w[parentKey], volumePct)
  }
  return out
}

export function autoVolumeFor(parentKey: string, parentWeight: number, volumePct: number = DEFAULT_VOLUME_PCT): number {
  const step = AUTO_STEP[`${parentKey}Vol`] ?? 5
  return Math.round((parentWeight * volumePct) / step) * step
}

/**
 * Diffs the auto-derived volume weights against a recompute. THE single
 * definition of the recompute-and-diff step that three routes previously
 * copy-pasted (sessions/log, programs/settings, weights/[key]) — and which had
 * already diverged in error handling. Pure: takes the current weights, an
 * optional key override (weights/[key] applies the just-edited value before
 * recomputing), and returns only the AUTO_KEYS rows whose value genuinely
 * changed. Callers decide how to persist (RPC payload vs. direct update).
 */
export function diffAutoWeights(
  weights: Array<{ key: string; weight_lbs: number }>,
  volumePct: number,
  overrides?: Record<string, number>
): Array<{ key: string; weight_lbs: number }> {
  const map: Record<string, number> = Object.fromEntries(weights.map((w) => [w.key, w.weight_lbs]))
  if (overrides) Object.assign(map, overrides)
  const recomputed = recompute(map, volumePct)
  const out: Array<{ key: string; weight_lbs: number }> = []
  for (const key of AUTO_KEYS) {
    const newVal = recomputed[key]
    const existing = weights.find((w) => w.key === key)
    if (existing && newVal !== undefined && newVal !== existing.weight_lbs) {
      out.push({ key, weight_lbs: newVal })
    }
  }
  return out
}

/**
 * Session volume from per-set entries. THE single definition of the volume
 * rule: completed sets only, must have a weight and a weight_key, and
 * auto-derived volume keys are EXCLUDED so volume-day work isn't
 * double-counted against intensity. Used by both the log route (persisted
 * volume_lbs) and the Today page (live header volume) so the number shown
 * mid-workout always matches the number saved.
 */
export function sessionVolume(
  entries: Array<{ weightKey: string | null; weightLbs: number | null; reps: number; completed: boolean }>
): number {
  return entries
    .filter((e) => e.completed && e.weightLbs != null && e.weightKey != null && !AUTO_KEYS.has(e.weightKey))
    .reduce((acc, e) => acc + e.weightLbs! * e.reps, 0)
}

/**
 * The friday_alt flip. Lives here so the log route (advance), undo RPC docs,
 * and any UI preview all share one rule instead of three inline ternaries.
 */
export function nextFridayAlt(current: 'A1' | 'A2'): 'A1' | 'A2' {
  return current === 'A1' ? 'A2' : 'A1'
}

export type LiftResult =
  | { status: 'up'; weight: number; failures: number; streak: number; pr: number; from: number; to: number; isPR: boolean }
  | { status: 'down'; weight: number; failures: number; streak: number; pr: number; from: number; to: number; reason: string }
  | { status: 'hold'; weight: number; failures: number; streak: number; pr: number }

export function processLift(params: {
  key: string
  completed: boolean
  weight: number
  failures: number
  streak: number
  pr: number
}): LiftResult {
  const { key, completed, weight, failures, streak, pr } = params

  if (completed) {
    const inc = INCREMENTS[key] ?? 0
    const newWeight = weight + inc
    const newPR = Math.max(pr ?? 0, newWeight)
    return {
      status: 'up',
      weight: newWeight,
      failures: 0,
      streak: streak + 1,
      pr: newPR,
      from: weight,
      to: newWeight,
      isPR: newWeight >= newPR,
    }
  }

  const newFailures = failures + 1
  if (newFailures >= 3) {
    const inc = INCREMENTS[key]
    const newWeight = Math.max(inc, Math.round((weight * 0.95) / inc) * inc)
    return {
      status: 'down',
      weight: newWeight,
      failures: 0,
      streak: 0,
      pr,
      from: weight,
      to: newWeight,
      reason: '3 failures',
    }
  }

  return { status: 'hold', weight, failures: newFailures, streak: 0, pr }
}

const HEAVY_COMPOUNDS = new Set(['squat', 'bench', 'incline', 'ohp', 'deadlift', 'row'])
const ACCESSORY_LIFTS = new Set(['cgbp', 'rdl', 'goodMornings'])

/**
 * Returns rest seconds for an exercise, or null when no rest is appropriate
 * (runs). Volume work uses 120s, heavy compounds use 180s on intensity days
 * and 120s on volume days, accessories use 90s, bodyweight uses 60s.
 */
export function getRestSeconds(exercise: Exercise, isVolumeDay: boolean): number | null {
  if (exercise.is_run || exercise.progression_type === 'run') return null
  if (exercise.progression_type === 'bodyweight') return 60

  const key = exercise.weight_key
  if (key && AUTO_KEYS.has(key)) return 120

  if (key && PROGRESSABLE.has(key)) {
    if (HEAVY_COMPOUNDS.has(key)) return isVolumeDay ? 120 : 180
    if (ACCESSORY_LIFTS.has(key)) return 90
  }

  return 90
}

export const LIFT_LABELS: Record<string, string> = {
  squat: 'Back Squat',
  bench: 'Bench Press',
  incline: 'Incline Bench',
  cgbp: 'Close-Grip Bench',
  ohp: 'Overhead Press',
  deadlift: 'Deadlift',
  row: 'Barbell Row',
  rdl: 'Romanian DL',
  goodMornings: 'Good Mornings',
  squatVol: 'Squat — Volume',
  benchVol: 'Bench — Volume',
  inclineVol: 'Incline — Volume',
  ohpVol: 'OHP — Volume',
  rowVol: 'Row — Volume',
}
