// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG, FALLBACK_EXERCISE } from '@shared/constants/exercises'
import { isValidExercise } from '@shared/validation/exercise'
import type { FocusDirection } from '@shared/types/progress'

const FOCUS_DIRECTIONS: FocusDirection[] = [
  'mobility',
  'light_athletics',
  'strength',
  'body_belts',
  'striking',
  'balance'
]

describe('exercise catalog', () => {
  it('keeps the documented size of 34 exercises', () => {
    expect(EXERCISE_CATALOG).toHaveLength(34)
  })

  it('has unique ids and titles', () => {
    const ids = EXERCISE_CATALOG.map((exercise) => exercise.id)
    const titles = EXERCISE_CATALOG.map((exercise) => exercise.title)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('passes the shared payload validation for every entry', () => {
    for (const exercise of EXERCISE_CATALOG) {
      expect(isValidExercise(exercise), exercise.id).toBe(true)
    }
  })

  it('assigns every entry to a known group with a positive timer', () => {
    for (const exercise of EXERCISE_CATALOG) {
      expect(['upper', 'lower', 'full', 'equipment']).toContain(exercise.group)
      expect(exercise.durationSec).toBeGreaterThan(0)
      expect(exercise.category.length).toBeGreaterThan(0)
    }
  })

  it('uses only known focus directions', () => {
    for (const exercise of EXERCISE_CATALOG) {
      for (const direction of exercise.focus ?? []) {
        expect(FOCUS_DIRECTIONS, exercise.id).toContain(direction)
      }
    }
  })

  it('keeps equipment exercises behind the inventory layer', () => {
    const equipment = EXERCISE_CATALOG.filter((exercise) => exercise.equipment?.length)
    expect(equipment.length).toBeGreaterThan(0)
    for (const exercise of equipment) {
      expect(exercise.equipment?.every((item) => typeof item === 'string' && item.length > 0)).toBe(
        true
      )
    }
  })

  it('exposes a valid fallback exercise', () => {
    expect(isValidExercise(FALLBACK_EXERCISE)).toBe(true)
    expect(FALLBACK_EXERCISE).toBe(EXERCISE_CATALOG[0])
  })
})
