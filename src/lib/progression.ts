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
