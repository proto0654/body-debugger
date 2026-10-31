// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOUND_SETTINGS,
  SOUND_CUES,
  VOICE_CUE_EVENTS,
  VOICE_EVENTS,
  VOICE_EVENT_LABELS,
  canPlayCue,
  cueForSessionStatus,
  isSoundPackId,
  isVoiceEvent,
  normalizeSoundSettings,
  pickVoiceVariant
} from '@shared/domain/sounds'

describe('sound settings', () => {
  it('starts enabled for new profiles, with the default pack and an audible volume', () => {
    expect(DEFAULT_SOUND_SETTINGS.enabled).toBe(true)
    expect(DEFAULT_SOUND_SETTINGS.packId).toBe('default')
    expect(DEFAULT_SOUND_SETTINGS.voiceEnabled).toBe(true)
    expect(DEFAULT_SOUND_SETTINGS.volume).toBeGreaterThan(0)
    expect(DEFAULT_SOUND_SETTINGS.volume).toBeLessThanOrEqual(1)
  })

  it('fills a settings file written before the sound layer existed', () => {
    expect(normalizeSoundSettings(undefined)).toEqual({ ...DEFAULT_SOUND_SETTINGS, enabled: false })
    expect(normalizeSoundSettings({})).toEqual({ ...DEFAULT_SOUND_SETTINGS, enabled: false })
  })

  it('keeps the stored switch, pack and volume', () => {
    expect(
      normalizeSoundSettings({ enabled: true, volume: 0.35, packId: 'default' })
    ).toEqual({ enabled: true, volume: 0.35, packId: 'default', voiceEnabled: true })
    expect(
      normalizeSoundSettings({ enabled: true, volume: 0.35, packId: 'default', voiceEnabled: true })
    ).toEqual({ enabled: true, volume: 0.35, packId: 'default', voiceEnabled: true })
    expect(
      normalizeSoundSettings({ enabled: true, volume: 0.35, packId: 'default', voiceEnabled: false }).voiceEnabled
    ).toBe(false)
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

describe('character voice mapping', () => {
  it('maps every cue that has a spoken event and keeps the rest effects-only', () => {
    expect(VOICE_CUE_EVENTS).toEqual({
      popup: 'ready',
      done: 'done',
      skip: 'skipped',
      snooze: 'snoozed',
      'stage-up': 'stage-up',
      streak: 'streak',
      alert: 'alert',
      error: 'error'
    })
    for (const cue of SOUND_CUES) expect(isVoiceEvent(VOICE_CUE_EVENTS[cue])).toBe(true)
  })

  it('rotates variants and never repeats the previous one', () => {
    const variants = ['01', '02', '03']
    expect(pickVoiceVariant(variants, null)).toBe('01')
    expect(pickVoiceVariant(variants, '01')).toBe('02')
    expect(pickVoiceVariant(variants, '03')).toBe('01')
    expect(pickVoiceVariant(['01'], '01')).toBe('01')
    expect(pickVoiceVariant([], '01')).toBeNull()
  })

  it('restarts the rotation when the previous variant is unknown', () => {
    expect(pickVoiceVariant(['01', '02'], 'stale')).toBe('01')
  })

  it('keeps a Russian label for every spoken event', () => {
    for (const event of VOICE_EVENTS) expect(VOICE_EVENT_LABELS[event]).toMatch(/[А-Яа-яЁё]/)
  })
})
