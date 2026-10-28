import type { Exercise, ExerciseDifficulty } from '../types/exercise'

const DIFFICULTIES: ExerciseDifficulty[] = [1, 2, 3, 4, 5]

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Type-guard for external / AI-proposed Exercise payloads.
 * Full Zod schema can replace this later; core must reject invalid data.
 */
export function isValidExercise(value: unknown): value is Exercise {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>

  if (!isNonEmptyString(e.id)) return false
  if (!isNonEmptyString(e.title)) return false
  if (!isNonEmptyString(e.description)) return false
  if (typeof e.durationSec !== 'number' || !Number.isFinite(e.durationSec) || e.durationSec <= 0) {
    return false
  }
  if (!DIFFICULTIES.includes(e.difficulty as ExerciseDifficulty)) return false
  if (!isNonEmptyString(e.category)) return false
  if (!isNonEmptyString(e.emojiFallback)) return false

  if (e.equipment !== undefined) {
    if (!Array.isArray(e.equipment) || !e.equipment.every((x) => typeof x === 'string')) {
      return false
    }
  }
  if (e.imageKey !== undefined && typeof e.imageKey !== 'string') return false
  if (e.modificationOf !== undefined && typeof e.modificationOf !== 'string') return false

  return true
}

export function assertExercise(value: unknown): Exercise {
  if (!isValidExercise(value)) {
    throw new Error('Invalid Exercise payload')
  }
  return value
}
