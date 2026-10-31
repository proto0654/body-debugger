// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  defaultSettings,
  normalizeProgress,
  normalizeSettings
} from '../../electron/main/persistence/defaults'
import type { AppSettings } from '@shared/types/settings'

describe('settings defaults', () => {
  it('enables new profiles while preserving a legacy mute and explicit sound preferences', () => {
    expect(normalizeSettings(undefined).sound).toEqual({ enabled: true, volume: 0.4, packId: 'default', voiceEnabled: false })
    expect(normalizeSettings({}).sound.enabled).toBe(false)
    expect(normalizeSettings({ sound: { enabled: false, volume: 0.2, packId: 'default', voiceEnabled: false } }).sound)
      .toEqual({ enabled: false, volume: 0.2, packId: 'default', voiceEnabled: false })
  })
  it('fills a setting added after the stored file was written', () => {
    const stored = { severity: 'soft', intervalMinutes: 25 } as Partial<AppSettings>
    const settings = normalizeSettings(stored)

    expect(settings.severity).toBe('soft')
    expect(settings.intervalMinutes).toBe(25)
    expect(settings.sessionExtras).toEqual({ enabled: false })
    expect(settings.inventory).toEqual({ enabled: false, items: [] })
    expect(settings.weight).toEqual({ enabled: false, targetKg: null })
    expect(settings.sound).toEqual({ enabled: false, volume: 0.4, packId: 'default', voiceEnabled: false })
    expect(settings.photos).toEqual({ enabled: false })
    expect(settings.ai).toEqual({ enabled: false })
  })

  it('normalizes a stored theme id', () => {
    expect(normalizeSettings({ themeId: 'night' }).themeId).toBe('night')
    expect(normalizeSettings({ themeId: 'rave' }).themeId).toBe('default')
  })

  it('sanitizes a stored sound block', () => {
    expect(
      normalizeSettings({ sound: { enabled: true, volume: 4, packId: 'rave', voiceEnabled: false } }).sound
    ).toEqual({ enabled: true, volume: 1, packId: 'default', voiceEnabled: false })
    expect(
      normalizeSettings({ sound: { enabled: true, volume: 0.3, packId: 'default', voiceEnabled: true } }).sound.voiceEnabled
    ).toBe(true)
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

  it('normalizes a stored progress snapshot', () => {
    const progress = normalizeProgress({
      streak: { current: -2, max: 3.7 },
      characterStage: 9 as never,
      characterBranch: 'wizard' as never,
      characterBuild: 'huge' as never,
      exerciseLevels: { plank: 2 },
      focus: { primary: 'strength', accents: ['mobility', 'nope' as never] }
    })

    expect(progress.streak).toEqual({ current: 0, max: 3 })
    expect(progress.characterStage).toBe(0)
    expect(progress.characterBranch).toBe('neutral')
    expect(progress.characterBuild).toBe('average')
    expect(progress.exerciseLevels).toEqual({ plank: 2 })
    expect(progress.focus).toEqual({ primary: 'strength', accents: ['mobility'] })
  })

  it('survives malformed nested values instead of crashing the load', () => {
    const settings = normalizeSettings({
      focus: { accents: 'mobility' },
      inventory: { items: 'bag-50' }
    } as never)
    expect(settings.focus.accents).toEqual([])
    expect(settings.inventory.items).toEqual([])

    const progress = normalizeProgress({
      exerciseLevels: { plank: 'two' },
      focus: { accents: 'mobility' }
    } as never)
    expect(progress.exerciseLevels).toEqual({})
    expect(progress.focus.accents).toEqual([])
  })

  it('falls back to default progress for a missing file', () => {
    expect(normalizeProgress(null)).toEqual({
      streak: { current: 0, max: 0 },
      characterStage: 0,
      characterBranch: 'neutral',
      characterBuild: 'average',
      exerciseLevels: {},
      focus: { primary: null, accents: [] }
    })
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
