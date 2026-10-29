import { EXERCISE_CATALOG } from '../../shared/constants/exercises'
import {
  canApproveExercise,
  mergeCatalogs
} from '../../shared/domain/ai-proposal'
import type { Exercise } from '../../shared/types/exercise'
import { isValidExercise } from '../../shared/validation/exercise'
import { readJsonEnvelope, writeJsonEnvelope } from './persistence/json-file'
import { getCustomExercisesPath } from './persistence/paths'

/**
 * User-approved AI exercises (CONCEPT.md §9). Main owns the file; the shipped
 * catalog always wins on id conflicts, so an import cannot replace core content.
 */

let custom: Exercise[] = []

function clone(exercise: Exercise): Exercise {
  return {
    ...exercise,
    ...(exercise.equipment ? { equipment: [...exercise.equipment] } : {}),
    ...(exercise.focus ? { focus: [...exercise.focus] } : {})
  }
}

function takenIds(): string[] {
  return [
    ...EXERCISE_CATALOG.map((exercise) => exercise.id),
    ...custom.map((exercise) => exercise.id)
  ]
}

export function loadCustomExercises(): void {
  const stored = readJsonEnvelope<unknown>(getCustomExercisesPath())
  if (!Array.isArray(stored)) {
    custom = []
    return
  }

  const seen = new Set(EXERCISE_CATALOG.map((exercise) => exercise.id))
  custom = []
  for (const value of stored) {
    if (!isValidExercise(value) || seen.has(value.id)) continue
    seen.add(value.id)
    custom.push(clone(value))
  }
}

export function listCustomExercises(): Exercise[] {
  return custom.map(clone)
}

export function addCustomExercise(value: unknown): Exercise | null {
  if (!isValidExercise(value)) return null
  if (!canApproveExercise(value, takenIds()).ok) return null

  custom = [...custom, clone(value)]
  try {
    writeJsonEnvelope(getCustomExercisesPath(), custom)
    return clone(value)
  } catch (error) {
    console.error('[custom-exercises] failed to save an approved exercise', error)
    custom = custom.filter((exercise) => exercise.id !== value.id)
    return null
  }
}

export function removeCustomExercise(id: string): boolean {
  const before = custom.length
  custom = custom.filter((exercise) => exercise.id !== id)
  if (custom.length === before) return false

  try {
    writeJsonEnvelope(getCustomExercisesPath(), custom)
    return true
  } catch (error) {
    console.error('[custom-exercises] failed to remove an exercise', error)
    return false
  }
}

/** Shipped catalog + approved proposals; the picker consumes this list. */
export function getAvailableCatalog(): Exercise[] {
  return mergeCatalogs(EXERCISE_CATALOG, custom)
}
