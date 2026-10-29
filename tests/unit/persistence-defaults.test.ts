// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { defaultSettings, normalizeSettings } from '../../electron/main/persistence/defaults'
import type { AppSettings } from '@shared/types/settings'

describe('settings defaults', () => {
  it('fills a setting added after the stored file was written', () => {
    const stored = { severity: 'soft', intervalMinutes: 25 } as Partial<AppSettings>
    const settings = normalizeSettings(stored)

    expect(settings.severity).toBe('soft')
    expect(settings.intervalMinutes).toBe(25)
    expect(settings.sessionExtras).toEqual({ enabled: false })
    expect(settings.inventory).toEqual({ enabled: false, items: [] })
    expect(settings.weight).toEqual({ enabled: false, targetKg: null })
  })

  it('keeps stored nested values and copies their arrays', () => {
    const stored = {
      inventory: { enabled: true, items: ['bag-50'] },
      focus: { primary: 'strength', accents: ['mobility'] }
    } as Partial<AppSettings>

    const settings = normalizeSettings(stored)
    expect(settings.inventory.items).toEqual(['bag-50'])
    expect(settings.focus.accents).toEqual(['mobility'])

    stored.inventory!.items.push('punching-bag')
    stored.focus!.accents.push('balance')
    expect(settings.inventory.items).toEqual(['bag-50'])
    expect(settings.focus.accents).toEqual(['mobility'])
  })

  it('falls back to the defaults when the file is missing', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings())
  })

  it('keeps a valid weight goal and drops a malformed one', () => {
    expect(normalizeSettings({ weight: { enabled: true, targetKg: 70.04 } }).weight).toEqual({
      enabled: true,
      targetKg: 70
    })
    expect(normalizeSettings({ weight: { enabled: true, targetKg: 1200 } }).weight).toEqual({
      enabled: true,
      targetKg: null
    })
  })
})
