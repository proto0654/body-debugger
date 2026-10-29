// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assertExercise, isValidExercise } from '@shared/validation/exercise'

const valid = {
  id: 'neck-circles',
  title: 'Круги головой',
  description: 'Медленные круги головой.',
  durationSec: 45,
  difficulty: 1,
  category: 'neck',
  emojiFallback: '🧘'
}

/** Builds an arbitrary (possibly invalid) payload while keeping the literal typed. */
function payload(overrides: Record<string, unknown> = {}): unknown {
  return { ...valid, ...overrides }
}

describe('isValidExercise', () => {
  it('accepts a minimal exercise', () => {
    expect(isValidExercise(payload())).toBe(true)
  })

  it('accepts optional fields of the right type', () => {
    expect(
      isValidExercise(
        payload({
          equipment: ['bag-50'],
          imageKey: 'neck-circles',
          modificationOf: 'neck-tilts'
        })
      )
    ).toBe(true)
  })

  it.each([null, undefined, 'exercise', 42, [], () => valid])(
    'rejects non-object payload %s',
    (candidate) => {
      expect(isValidExercise(candidate)).toBe(false)
    }
  )

  it.each(['id', 'title', 'description', 'category', 'emojiFallback'])(
    'rejects a missing or blank %s',
    (field) => {
      expect(isValidExercise(payload({ [field]: '' }))).toBe(false)
      expect(isValidExercise(payload({ [field]: '   ' }))).toBe(false)
      expect(isValidExercise(payload({ [field]: 42 }))).toBe(false)

      const withoutField: Record<string, unknown> = { ...valid }
      delete withoutField[field]
      expect(isValidExercise(withoutField)).toBe(false)
    }
  )

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '45'])(
    'rejects durationSec %s',
    (durationSec) => {
      expect(isValidExercise(payload({ durationSec }))).toBe(false)
    }
  )

  it.each([0, 6, 1.5, '3', null])('rejects difficulty %s', (difficulty) => {
    expect(isValidExercise(payload({ difficulty }))).toBe(false)
  })

  it.each([
    ['not-an-array', false],
    [['bag-50', 42], false],
    [[], true],
    [['bag-50'], true]
  ])('validates equipment %j', (equipment, expected) => {
    expect(isValidExercise(payload({ equipment }))).toBe(expected)
  })

  it('validates optional string fields', () => {
    expect(isValidExercise(payload({ imageKey: 42 }))).toBe(false)
    expect(isValidExercise(payload({ modificationOf: 42 }))).toBe(false)
    expect(isValidExercise(payload({ imageKey: undefined }))).toBe(true)
  })
})

describe('assertExercise', () => {
  it('returns the payload when valid', () => {
    expect(assertExercise(payload())).toBeDefined()
  })

  it('throws on an invalid payload', () => {
    expect(() => assertExercise(payload({ durationSec: 0 }))).toThrow('Invalid Exercise payload')
  })
})
