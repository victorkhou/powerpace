import { PROGRESSABLE, AUTO_PARENT } from '@/lib/progression'

export type ExerciseShape = {
  name: string
  sets: number
  reps: number
  weight_key: string | null
  progression_type: 'linear' | 'auto' | 'bodyweight' | 'run'
  increment_lbs: number | null
  is_auto_volume: boolean
  parent_key: string | null
  is_run: boolean
  sort_order: number
}

const PROGRESSION_TYPES = new Set(['linear', 'auto', 'bodyweight', 'run'])

export function validateExercise(e: Partial<ExerciseShape>): string | null {
  if (e.name != null && (typeof e.name !== 'string' || !e.name.trim())) {
    return 'name must be a non-empty string'
  }
  if (e.sets != null && (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20)) {
    return 'sets must be an integer 1-20'
  }
  if (e.reps != null && (!Number.isInteger(e.reps) || e.reps < 1 || e.reps > 50)) {
    return 'reps must be an integer 1-50'
  }
  if (e.progression_type != null && !PROGRESSION_TYPES.has(e.progression_type)) {
    return `progression_type must be one of: ${[...PROGRESSION_TYPES].join(', ')}`
  }
  if (e.increment_lbs != null && (typeof e.increment_lbs !== 'number' || e.increment_lbs <= 0 || e.increment_lbs > 50)) {
    return 'increment_lbs must be a positive number <= 50'
  }
  if (e.weight_key != null && typeof e.weight_key !== 'string') {
    return 'weight_key must be a string or null'
  }
  if (e.parent_key != null && typeof e.parent_key !== 'string') {
    return 'parent_key must be a string or null'
  }
  return null
}

export function validateExerciseFull(e: ExerciseShape): string | null {
  const base = validateExercise(e)
  if (base) return base
  if (e.progression_type === 'linear') {
    if (!e.weight_key) return 'linear progression requires a weight_key'
    if (!PROGRESSABLE.has(e.weight_key)) return `weight_key "${e.weight_key}" is not in PROGRESSABLE`
    if (e.increment_lbs == null) return 'linear progression requires increment_lbs'
  }
  if (e.progression_type === 'auto') {
    if (!e.weight_key) return 'auto progression requires a weight_key (volume key)'
    if (!e.parent_key) return 'auto progression requires a parent_key'
    if (AUTO_PARENT[e.weight_key] !== e.parent_key) {
      return `auto weight_key "${e.weight_key}" must derive from parent_key "${AUTO_PARENT[e.weight_key]}"`
    }
  }
  if (e.progression_type === 'bodyweight' || e.progression_type === 'run') {
    if (e.weight_key) return `${e.progression_type} progression must not have a weight_key`
  }
  return null
}
