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

export function recompute(w: Record<string, number>): Record<string, number> {
  return {
    ...w,
    squatVol: Math.round((w.squat * 0.875) / 5) * 5,
    benchVol: Math.round((w.bench * 0.875) / 2.5) * 2.5,
    inclineVol: Math.round((w.incline * 0.875) / 2.5) * 2.5,
    ohpVol: Math.round((w.ohp * 0.875) / 2.5) * 2.5,
    rowVol: Math.round((w.row * 0.875) / 5) * 5,
  }
}

export function autoVolumeFor(parentKey: string, parentWeight: number): number {
  const step = AUTO_STEP[`${parentKey}Vol`] ?? 5
  return Math.round((parentWeight * 0.875) / step) * step
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
