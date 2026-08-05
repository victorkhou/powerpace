import { describe, it, expect } from 'vitest'
import { deriveWeek, weeksBetween, anchorForCorrection, type WeekAnchor } from './week'

// 2026-06-08 is a Monday.
const ANCHOR: WeekAnchor = { date: '2026-06-08', number: 1, type: 'A' }

/** A local Date for a YYYY-MM-DD key (avoids UTC parsing shifting the day). */
function d(key: string): Date {
  const [y, m, day] = key.split('-').map(Number)
  return new Date(y, m - 1, day, 12)
}

describe('weeksBetween', () => {
  it('counts whole weeks forward', () => {
    expect(weeksBetween('2026-06-08', '2026-06-08')).toBe(0)
    expect(weeksBetween('2026-06-08', '2026-06-15')).toBe(1)
    expect(weeksBetween('2026-06-08', '2026-08-03')).toBe(8)
  })

  it('is negative before the anchor', () => {
    expect(weeksBetween('2026-06-08', '2026-06-01')).toBe(-1)
  })

  it('is unaffected by a DST transition', () => {
    // US DST ends 2026-11-01; the week spanning it is still one week.
    expect(weeksBetween('2026-10-26', '2026-11-02')).toBe(1)
    // And across the spring transition (2026-03-08).
    expect(weeksBetween('2026-03-02', '2026-03-09')).toBe(1)
  })
})

describe('deriveWeek', () => {
  it('returns the anchor values during the anchor week', () => {
    expect(deriveWeek(ANCHOR, d('2026-06-08'))).toEqual({ number: 1, type: 'A' })
    // Still the anchor week on the Sunday that ends it.
    expect(deriveWeek(ANCHOR, d('2026-06-14'))).toEqual({ number: 1, type: 'A' })
  })

  it('advances the number and flips the type each week', () => {
    expect(deriveWeek(ANCHOR, d('2026-06-15'))).toEqual({ number: 2, type: 'B' })
    expect(deriveWeek(ANCHOR, d('2026-06-22'))).toEqual({ number: 3, type: 'A' })
    expect(deriveWeek(ANCHOR, d('2026-06-29'))).toEqual({ number: 4, type: 'B' })
  })

  it('rolls over at the Monday boundary, not mid-week', () => {
    // Sunday night is still the old week; Monday morning is the new one.
    expect(deriveWeek(ANCHOR, d('2026-06-14')).number).toBe(1)
    expect(deriveWeek(ANCHOR, d('2026-06-15')).number).toBe(2)
  })

  it('handles a long gap — the bug this replaces', () => {
    // A program anchored in June read "week 1 / A" in August before this change.
    expect(deriveWeek(ANCHOR, d('2026-08-03'))).toEqual({ number: 9, type: 'A' })
  })

  it('clamps dates before the anchor instead of going negative', () => {
    expect(deriveWeek(ANCHOR, d('2026-06-01'))).toEqual({ number: 1, type: 'A' })
    expect(deriveWeek(ANCHOR, d('2026-01-01'))).toEqual({ number: 1, type: 'A' })
  })

  it('respects a non-1 anchor number and B anchor type', () => {
    const a: WeekAnchor = { date: '2026-06-08', number: 5, type: 'B' }
    expect(deriveWeek(a, d('2026-06-08'))).toEqual({ number: 5, type: 'B' })
    expect(deriveWeek(a, d('2026-06-15'))).toEqual({ number: 6, type: 'A' })
    expect(deriveWeek(a, d('2026-06-22'))).toEqual({ number: 7, type: 'B' })
  })
})

describe('anchorForCorrection', () => {
  it('anchors to the Monday of the week containing the given date', () => {
    // Wednesday 2026-08-05 -> Monday 2026-08-03.
    expect(anchorForCorrection(3, 'B', d('2026-08-05'))).toEqual({
      date: '2026-08-03',
      number: 3,
      type: 'B',
    })
  })

  it('round-trips: correcting to N/T means deriveWeek returns N/T that week', () => {
    const on = d('2026-08-05')
    const a = anchorForCorrection(12, 'B', on)
    expect(deriveWeek(a, on)).toEqual({ number: 12, type: 'B' })
    // And advances correctly from the corrected point.
    expect(deriveWeek(a, d('2026-08-10'))).toEqual({ number: 13, type: 'A' })
  })
})
