// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOUND_SETTINGS,
  SOUND_CUES,
  canPlayCue,
  cueForSessionStatus,
  isSoundPackId,
  normalizeSoundSettings
} from '@shared/domain/sounds'

describe('sound settings', () => {
  it('starts muted, with the default pack and an audible volume', () => {
    expect(DEFAULT_SOUND_SETTINGS.enabled).toBe(false)
    expect(DEFAULT_SOUND_SETTINGS.packId).toBe('default')
    expect(DEFAULT_SOUND_SETTINGS.volume).toBeGreaterThan(0)
    expect(DEFAULT_SOUND_SETTINGS.volume).toBeLessThanOrEqual(1)
  })

  it('fills a settings file written before the sound layer existed', () => {
    expect(normalizeSoundSettings(undefined)).toEqual(DEFAULT_SOUND_SETTINGS)
    expect(normalizeSoundSettings({})).toEqual(DEFAULT_SOUND_SETTINGS)
  })

  it('keeps the stored switch, pack and volume', () => {
    expect(
      normalizeSoundSettings({ enabled: true, volume: 0.35, packId: 'default' })
    ).toEqual({ enabled: true, volume: 0.35, packId: 'default' })
  })

  it('clamps volume into 0..1 and rejects a non-finite value', () => {
    expect(normalizeSoundSettings({ enabled: true, volume: 2 }).volume).toBe(1)
    expect(normalizeSoundSettings({ enabled: true, volume: -1 }).volume).toBe(0)
    expect(normalizeSoundSettings({ enabled: true, volume: Number.NaN }).volume).toBe(
      DEFAULT_SOUND_SETTINGS.volume
    )
    expect(normalizeSoundSettings({ enabled: true, volume: Infinity }).volume).toBe(
      DEFAULT_SOUND_SETTINGS.volume
    )
  })

  it('falls back to the shipped pack for an unknown pack id', () => {
    expect(normalizeSoundSettings({ packId: 'rave' }).packId).toBe('default')
    expect(isSoundPackId('default')).toBe(true)
    expect(isSoundPackId('rave')).toBe(false)
  })
})

describe('sound cue mapping', () => {
  it('covers every event documented in SOUNDS.md', () => {
    expect(SOUND_CUES).toEqual([
      'popup',
      'done',
      'skip',
      'snooze',
      'stage-up',
      'streak',
      'alert',
      'error'
    ])
  })

  it('maps a resolved session to its cue', () => {
    expect(cueForSessionStatus('done')).toBe('done')
    expect(cueForSessionStatus('skipped')).toBe('skip')
    expect(cueForSessionStatus('snoozed')).toBe('snooze')
  })

  it('never cues an unanswered popup', () => {
    expect(cueForSessionStatus('missed')).toBeNull()
  })
})

describe('sound playback gate', () => {
  const enabled = { ...DEFAULT_SOUND_SETTINGS, enabled: true }

  it('plays when the master switch is on', () => {
    expect(canPlayCue(enabled)).toBe(true)
  })

  it('stays silent while the master switch is off', () => {
    expect(canPlayCue({ ...enabled, enabled: false })).toBe(false)
  })

  it('stays silent at zero volume', () => {
    expect(canPlayCue({ ...enabled, volume: 0 })).toBe(false)
  })

  it('stays silent while reminders are paused (SOUNDS.md principle 4)', () => {
    expect(canPlayCue(enabled, { paused: true })).toBe(false)
  })

  it('stays silent in do-not-disturb / call mode', () => {
    expect(canPlayCue(enabled, { quiet: true })).toBe(false)
  })
})
