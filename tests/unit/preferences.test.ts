// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_PICKER_MODE,
  INTERVAL_MINUTES_MAX,
  INTERVAL_MINUTES_MIN,
  INTERVAL_PRESETS,
  PICKER_MODES,
  isPickerMode,
  isSameFocus,
  normalizeFocus,
  normalizeIntervalMinutes
} from '@shared/domain/preferences'
import { makeFocus } from '../fixtures'

describe('reminder interval', () => {
  it('keeps in-range whole minutes', () => {
    expect(normalizeIntervalMinutes(30)).toBe(30)
    expect(normalizeIntervalMinutes(INTERVAL_MINUTES_MIN)).toBe(INTERVAL_MINUTES_MIN)
    expect(normalizeIntervalMinutes(INTERVAL_MINUTES_MAX)).toBe(INTERVAL_MINUTES_MAX)
  })

  it('rounds fractional and numeric-string input', () => {
    expect(normalizeIntervalMinutes(29.6)).toBe(30)
    expect(normalizeIntervalMinutes('72')).toBe(72)
  })

  it('rejects out-of-range and non-numeric input instead of clamping', () => {
    for (const value of [0, 4, 241, -45, 'abc', '', null, undefined, Number.NaN, Infinity]) {
      expect(normalizeIntervalMinutes(value)).toBeNull()
    }
  })

  it('keeps every quick preset inside the bounds', () => {
    expect(INTERVAL_PRESETS.length).toBeGreaterThan(0)

    for (const preset of INTERVAL_PRESETS) {
      expect(preset).toBeGreaterThanOrEqual(INTERVAL_MINUTES_MIN)
      expect(preset).toBeLessThanOrEqual(INTERVAL_MINUTES_MAX)
      expect(normalizeIntervalMinutes(preset)).toBe(preset)
    }
    expect(INTERVAL_PRESETS).toContain(DEFAULT_INTERVAL_MINUTES)
  })
})

describe('picker mode', () => {
  it('accepts the four documented modes', () => {
    expect(PICKER_MODES).toEqual(['balance', 'rotation', 'focus', 'push'])
    expect(PICKER_MODES.every(isPickerMode)).toBe(true)
    expect(DEFAULT_PICKER_MODE).toBe('balance')
  })

  it('rejects anything else', () => {
    expect(isPickerMode('rave')).toBe(false)
    expect(isPickerMode(null)).toBe(false)
    expect(isPickerMode(3)).toBe(false)
  })
})

describe('focus preferences', () => {
  it('keeps a known primary and known accents', () => {
    expect(normalizeFocus('strength', ['mobility', 'balance'])).toEqual({
      primary: 'strength',
      accents: ['mobility', 'balance']
    })
  })

  it('drops unknown values and duplicate accents', () => {
    expect(normalizeFocus('yoga', ['mobility', 'mobility', 'rave', 42])).toEqual({
      primary: null,
      accents: ['mobility']
    })
  })

  it('never keeps the primary among the accents', () => {
    expect(normalizeFocus('strength', ['strength', 'balance'])).toEqual({
      primary: 'strength',
      accents: ['balance']
    })
  })

  it('treats a non-array accents value as empty', () => {
    expect(normalizeFocus(null, 'mobility')).toEqual({ primary: null, accents: [] })
  })

  it('compares focus values by value', () => {
    expect(isSameFocus(makeFocus(), { primary: null, accents: [] })).toBe(true)
    expect(
      isSameFocus(
        { primary: 'strength', accents: ['balance'] },
        { primary: 'strength', accents: ['balance'] }
      )
    ).toBe(true)
    expect(
      isSameFocus(
        { primary: 'strength', accents: ['balance'] },
        { primary: 'strength', accents: ['mobility'] }
      )
    ).toBe(false)
    expect(isSameFocus({ primary: null, accents: [] }, { primary: 'balance', accents: [] })).toBe(
      false
    )
  })
})
