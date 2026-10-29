import { describe, expect, it } from 'vitest'
import {
  FEELING_VALUES,
  normalizeSessionExtras,
  roundWeightKg
} from '@shared/domain/session-extras'

describe('normalizeSessionExtras', () => {
  it('keeps in-range reps, feeling and weight', () => {
    expect(normalizeSessionExtras({ reps: 12, feeling: 4, weightKg: 72.5 })).toEqual({
      reps: 12,
      feeling: 4,
      weightKg: 72.5
    })
  })

  it('accepts numeric strings from the popup inputs', () => {
    expect(normalizeSessionExtras({ reps: ' 15 ', feeling: '5', weightKg: '81.4' })).toEqual({
      reps: 15,
      feeling: 5,
      weightKg: 81.4
    })
  })

  it('rounds weight to one decimal', () => {
    expect(normalizeSessionExtras({ weightKg: 72.55 })).toEqual({ weightKg: 72.6 })
    expect(roundWeightKg(72.44)).toBe(72.4)
  })

  it('drops values outside the documented ranges', () => {
    expect(normalizeSessionExtras({ reps: 0, feeling: 9, weightKg: 5 })).toEqual({})
    expect(normalizeSessionExtras({ reps: 1000, feeling: 0, weightKg: 301 })).toEqual({})
  })

  it('drops blank and non-numeric values', () => {
    expect(
      normalizeSessionExtras({ reps: '', feeling: null, weightKg: 'тяжёлый' })
    ).toEqual({})
    expect(normalizeSessionExtras({ reps: Number.NaN, weightKg: Number.POSITIVE_INFINITY })).toEqual(
      {}
    )
  })

  it('rejects fractional reps and feelings', () => {
    expect(normalizeSessionExtras({ reps: 12.5, feeling: 3.5 })).toEqual({})
  })

  it('returns only the fields that survived validation', () => {
    expect(normalizeSessionExtras({ reps: 8, weightKg: 600 })).toEqual({ reps: 8 })
  })

  it('exposes the five feeling values used by the popup', () => {
    expect(FEELING_VALUES).toEqual([1, 2, 3, 4, 5])
  })
})
