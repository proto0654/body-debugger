// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_ID,
  THEMES,
  isThemeId,
  normalizeThemeId,
  themeById
} from '@shared/constants/themes'

describe('theme catalog', () => {
  it('ships a unique, labelled theme for every id', () => {
    const ids = THEMES.map((theme) => theme.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_THEME_ID)
    for (const theme of THEMES) {
      expect(theme.title.trim().length).toBeGreaterThan(0)
      expect(isThemeId(theme.id)).toBe(true)
    }
  })

  it('has a stable lookup for the default theme', () => {
    expect(themeById(DEFAULT_THEME_ID)?.id).toBe(DEFAULT_THEME_ID)
    expect(themeById('missing')).toBeNull()
  })

  it('normalizes an unknown or malformed id to the default', () => {
    expect(normalizeThemeId('night')).toBe('night')
    expect(normalizeThemeId('rave')).toBe(DEFAULT_THEME_ID)
    expect(normalizeThemeId(undefined)).toBe(DEFAULT_THEME_ID)
    expect(normalizeThemeId(42)).toBe(DEFAULT_THEME_ID)
  })
})
