import { describe, it, expect } from 'vitest'
import { processLift, recompute, autoVolumeFor, formatVolumePct, INCREMENTS, AUTO_PARENT } from './progression'

describe('processLift', () => {
  it('increments by the lift increment and bumps streak on a completed set', () => {
    const r = processLift({ key: 'squat', completed: true, weight: 220, failures: 0, streak: 2, pr: 220 })
    expect(r.status).toBe('up')
    expect(r.weight).toBe(225)
    expect(r.streak).toBe(3)
    expect(r.failures).toBe(0)
  })

  it('uses the per-lift increment (rdl = 2.5)', () => {
    const r = processLift({ key: 'rdl', completed: true, weight: 115, failures: 0, streak: 0, pr: 115 })
    expect(r.weight).toBe(117.5)
  })

  it('flags a PR when the new weight meets or exceeds the prior PR', () => {
    const r = processLift({ key: 'bench', completed: true, weight: 157.5, failures: 0, streak: 1, pr: 157.5 })
    expect(r.status === 'up' && r.isPR).toBe(true)
  })

  it('holds and increments the failure counter on the 1st and 2nd miss', () => {
    const first = processLift({ key: 'squat', completed: false, weight: 220, failures: 0, streak: 3, pr: 230 })
    expect(first.status).toBe('hold')
    expect(first.failures).toBe(1)
    expect(first.streak).toBe(0)

    const second = processLift({ key: 'squat', completed: false, weight: 220, failures: 1, streak: 0, pr: 230 })
    expect(second.status).toBe('hold')
    expect(second.failures).toBe(2)
  })

  it('deloads 5% (rounded to the increment) on the 3rd consecutive failure and resets failures', () => {
    const r = processLift({ key: 'squat', completed: false, weight: 220, failures: 2, streak: 0, pr: 230 })
    expect(r.status).toBe('down')
    // round(220 * 0.95 / 5) * 5 = round(41.8)*5 = 42*5 = 210
    expect(r.weight).toBe(210)
    expect(r.failures).toBe(0)
    expect(r.streak).toBe(0)
  })

  it('never deloads below one increment', () => {
    const r = processLift({ key: 'squat', completed: false, weight: 3, failures: 2, streak: 0, pr: 100 })
    expect(r.status).toBe('down')
    expect(r.weight).toBeGreaterThanOrEqual(INCREMENTS.squat)
  })
})

describe('recompute', () => {
  it('derives every auto-volume key at 87.5% of its parent, rounded to the parent step', () => {
    const out = recompute({ squat: 220, bench: 157.5, incline: 145, ohp: 107.5, row: 120 })
    expect(out.squatVol).toBe(195) // round(220*0.875/5)*5
    expect(out.benchVol).toBe(137.5) // round(157.5*0.875/2.5)*2.5
    expect(out.inclineVol).toBe(127.5)
    expect(out.ohpVol).toBe(95)
    expect(out.rowVol).toBe(105)
  })

  it('preserves non-derived keys and covers every AUTO_PARENT entry', () => {
    const out = recompute({ squat: 220, bench: 157.5, incline: 145, ohp: 107.5, row: 120, deadlift: 225 })
    expect(out.deadlift).toBe(225)
    for (const volKey of Object.keys(AUTO_PARENT)) {
      expect(out[volKey]).toBeTypeOf('number')
    }
  })

  it('agrees with autoVolumeFor for each parent', () => {
    const weights = { squat: 220, bench: 157.5, incline: 145, ohp: 107.5, row: 120 }
    const out = recompute(weights)
    for (const [volKey, parentKey] of Object.entries(AUTO_PARENT)) {
      expect(out[volKey]).toBe(autoVolumeFor(parentKey, weights[parentKey as keyof typeof weights]))
    }
  })

  it('applies a custom volume multiplier and rounds to the parent step', () => {
    // squat step 5: round(220*0.9/5)*5 = round(39.6)*5 = 40*5 = 200
    expect(autoVolumeFor('squat', 220, 0.9)).toBe(200)
    // bench step 2.5: round(157.5*0.8/2.5)*2.5 = round(50.4)*2.5 = 50*2.5 = 125
    expect(autoVolumeFor('bench', 157.5, 0.8)).toBe(125)
    const out = recompute({ squat: 220, bench: 157.5, incline: 145, ohp: 107.5, row: 120 }, 0.9)
    expect(out.squatVol).toBe(200)
  })

  it('defaults to 87.5% when no multiplier is passed', () => {
    expect(autoVolumeFor('squat', 220)).toBe(autoVolumeFor('squat', 220, 0.875))
  })
})

describe('formatVolumePct', () => {
  it('renders a fraction as a trimmed percentage', () => {
    expect(formatVolumePct(0.875)).toBe('87.5%')
    expect(formatVolumePct(0.9)).toBe('90%')
    expect(formatVolumePct()).toBe('87.5%')
  })
})
