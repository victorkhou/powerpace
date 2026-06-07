import { describe, it, expect } from 'vitest'
import { calcPlates } from './plates'

describe('calcPlates', () => {
  it('returns bar-only and exact when target equals the bar', () => {
    const r = calcPlates(45, 45)
    expect(r).toMatchObject({ plates: [], exact: true, belowBar: false })
  })

  it('flags belowBar when the target is under the bar', () => {
    const r = calcPlates(40, 45)
    expect(r.belowBar).toBe(true)
    expect(r.exact).toBe(false)
  })

  it('computes a clean per-side load for a standard target', () => {
    // (135 - 45) / 2 = 45 per side → one 45
    const r = calcPlates(135, 45)
    expect(r.plates).toEqual([45])
    expect(r.perSide).toBe(45)
    expect(r.exact).toBe(true)
    expect(r.remainder).toBe(0)
  })

  it('greedy-fills per side with the standard inventory', () => {
    // (225 - 45) / 2 = 90 per side → 45 + 45
    const r = calcPlates(225, 45)
    expect(r.plates).toEqual([45, 45])
    expect(r.exact).toBe(true)
  })

  it('reports the true off-by for an odd half-pound target (regression: was 3, should be 2.5)', () => {
    const r = calcPlates(47.5, 45)
    expect(r.plates).toEqual([])
    expect(r.exact).toBe(false)
    expect(r.remainder).toBe(2.5)
  })

  it('reports a 1 lb shortfall when no plate fits but target exceeds bar', () => {
    const r = calcPlates(46, 45)
    expect(r.plates).toEqual([])
    expect(r.exact).toBe(false)
    expect(r.belowBar).toBe(false)
    expect(r.remainder).toBe(1)
  })

  it('rejects sub-half-pound plate values instead of looping forever', () => {
    const r = calcPlates(100, 45, [45, 0.1])
    expect(r.belowBar).toBe(true)
  })

  it('guards non-finite input', () => {
    expect(calcPlates(NaN, 45).belowBar).toBe(true)
    expect(calcPlates(100, Infinity).belowBar).toBe(true)
  })
})
