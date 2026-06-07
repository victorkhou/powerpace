import { describe, it, expect } from 'vitest'
import { validateExercise, validateExerciseFull, type ExerciseShape } from './exercise-validation'

const base: ExerciseShape = {
  name: 'Back Squat',
  sets: 3,
  reps: 5,
  weight_key: 'squat',
  progression_type: 'linear',
  increment_lbs: 5,
  is_auto_volume: false,
  parent_key: null,
  is_run: false,
  sort_order: 0,
}

describe('validateExercise (partial)', () => {
  it('accepts a well-formed partial', () => {
    expect(validateExercise({ sets: 5, reps: 5 })).toBeNull()
  })
  it('rejects out-of-range sets/reps', () => {
    expect(validateExercise({ sets: 0 })).toMatch(/sets/)
    expect(validateExercise({ reps: 99 })).toMatch(/reps/)
  })
  it('rejects an empty name', () => {
    expect(validateExercise({ name: '   ' })).toMatch(/name/)
  })
  it('rejects a non-positive increment', () => {
    expect(validateExercise({ increment_lbs: 0 })).toMatch(/increment/)
  })
})

describe('validateExerciseFull (progression consistency)', () => {
  it('accepts a valid linear lift', () => {
    expect(validateExerciseFull(base)).toBeNull()
  })

  it('requires a PROGRESSABLE weight_key + increment for linear', () => {
    expect(validateExerciseFull({ ...base, weight_key: null })).toMatch(/weight_key/)
    expect(validateExerciseFull({ ...base, weight_key: 'notalift' })).toMatch(/PROGRESSABLE/)
    expect(validateExerciseFull({ ...base, increment_lbs: null })).toMatch(/increment_lbs/)
  })

  it('requires the auto weight_key to derive from its parent_key', () => {
    const goodAuto: ExerciseShape = {
      ...base,
      progression_type: 'auto',
      weight_key: 'squatVol',
      parent_key: 'squat',
      increment_lbs: null,
      is_auto_volume: true,
    }
    expect(validateExerciseFull(goodAuto)).toBeNull()
    expect(validateExerciseFull({ ...goodAuto, parent_key: 'bench' })).toMatch(/derive/)
    expect(validateExerciseFull({ ...goodAuto, parent_key: null })).toMatch(/parent_key/)
  })

  it('forbids a weight_key on bodyweight / run', () => {
    expect(validateExerciseFull({ ...base, progression_type: 'bodyweight', weight_key: 'squat' })).toMatch(/bodyweight/)
    expect(validateExerciseFull({ ...base, progression_type: 'run', weight_key: 'squat' })).toMatch(/run/)
    expect(
      validateExerciseFull({ ...base, progression_type: 'bodyweight', weight_key: null, increment_lbs: null })
    ).toBeNull()
  })
})
