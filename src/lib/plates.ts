// Plate calculator. Internally uses half-pound units (integers) to avoid float drift.

export const DEFAULT_BAR_LBS = 45
export const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5]

export type PlateCalcResult = {
  plates: number[]
  remainder: number
  perSide: number
  exact: boolean
  belowBar: boolean
}

export function calcPlates(
  targetLbs: number,
  barLbs: number = DEFAULT_BAR_LBS,
  plates: number[] = DEFAULT_PLATES,
): PlateCalcResult {
  if (!Number.isFinite(targetLbs) || !Number.isFinite(barLbs)) {
    return { plates: [], remainder: 0, perSide: 0, exact: false, belowBar: true }
  }
  if (!plates.every((p) => Number.isFinite(p) && p >= 0.5)) {
    return { plates: [], remainder: 0, perSide: 0, exact: false, belowBar: true }
  }
  if (targetLbs < barLbs) {
    return { plates: [], remainder: targetLbs, perSide: 0, exact: false, belowBar: true }
  }
  if (targetLbs === barLbs) {
    return { plates: [], remainder: 0, perSide: 0, exact: true, belowBar: false }
  }

  // Work in half-pound integer units.
  const toUnits = (lbs: number) => Math.round(lbs * 2)
  const fromUnits = (u: number) => u / 2

  const totalUnits = toUnits(targetLbs - barLbs)
  const perSideUnits = Math.floor(totalUnits / 2)
  const oddUnit = totalUnits - 2 * perSideUnits
  const sortedPlates = [...plates].sort((a, b) => b - a)

  let remaining = perSideUnits
  const used: number[] = []
  for (const p of sortedPlates) {
    const pu = toUnits(p)
    while (remaining >= pu) {
      used.push(p)
      remaining -= pu
    }
  }

  const remainderLbs = fromUnits(remaining) * 2 + fromUnits(oddUnit) // total (both sides)
  return {
    plates: used,
    remainder: remainderLbs,
    perSide: fromUnits(perSideUnits - remaining),
    exact: remaining === 0 && oddUnit === 0,
    belowBar: false,
  }
}
