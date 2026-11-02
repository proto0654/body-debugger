// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { SHIPPED_V2_TAGS } from '@shared/constants/exercise-v2-tags'
import {
  deriveExerciseFields,
  dominantZone,
  isValidExerciseV2,
  normalizeExerciseV2,
  round5,
  upgradeExercise
} from '@shared/domain/exercise-v2'

describe('exercise-v2 upgrade', () => {
  it('upgrades all 34 shipped exercises to valid ExerciseV2', () => {
    expect(EXERCISE_CATALOG).toHaveLength(34)
    for (const v1 of EXERCISE_CATALOG) {
      const v2 = upgradeExercise(v1)
      expect(isValidExerciseV2(v2), v1.id).toBe(true)
      const normalized = normalizeExerciseV2(v2)
      const derived = deriveExerciseFields(normalized)
      expect(derived.durationSec).toBe(v2.timer.defaultSec)
      expect(derived.dominantZone).toBe(dominantZone(normalized.zones))
      expect(v2.id).toBe(v1.id)
      expect(v2.status).toBe('active')
      expect(v2.source.kind).toBe('shipped')
      expect(v2.timer.minSec).toBeLessThanOrEqual(v2.timer.defaultSec)
      expect(v2.timer.defaultSec).toBeLessThanOrEqual(v2.timer.maxSec)
    }
  })

  it('rounds timer bounds to 5 seconds', () => {
    expect(round5(37)).toBe(35)
    expect(round5(38)).toBe(40)
    expect(round5(1)).toBe(5)
  })

  it('maps lowerBack toward core and full-body cardio to full', () => {
    const lowerBack = upgradeExercise(EXERCISE_CATALOG.find((e) => e.id === 'cat-cow-standing')!)
    expect(dominantZone(lowerBack.zones)).toBe('core')
    expect(lowerBack.method).toBe('mobility')

    const march = upgradeExercise(EXERCISE_CATALOG.find((e) => e.id === 'march-in-place')!)
    expect(march.method).toBe('cardio')
    expect(dominantZone(march.zones)).toBe('full')
  })

  it('keeps hand-retagged fields for every shipped id', () => {
    expect(Object.keys(SHIPPED_V2_TAGS)).toHaveLength(34)
    for (const v1 of EXERCISE_CATALOG) {
      expect(SHIPPED_V2_TAGS[v1.id], v1.id).toBeTruthy()
      expect(v1.method).toBe(SHIPPED_V2_TAGS[v1.id]!.method)
      expect(v1.context?.posture).toBe(SHIPPED_V2_TAGS[v1.id]!.context.posture)
      const v2 = upgradeExercise(v1)
      expect(v2.method).toBe(v1.method)
      expect(v2.context.posture).toBe(v1.context!.posture)
      if (v1.perSide) expect(v2.timer.perSide).toBe(true)
    }
  })

  it('rejects empty zones and bad timer order', () => {
    const base = upgradeExercise(EXERCISE_CATALOG[0]!)
    expect(isValidExerciseV2({ ...base, zones: {} })).toBe(false)
    expect(
      isValidExerciseV2({
        ...base,
        timer: { minSec: 40, defaultSec: 30, maxSec: 60 }
      })
    ).toBe(false)
    expect(isValidExerciseV2({ ...base, title: 'x'.repeat(41) })).toBe(false)
  })
})
