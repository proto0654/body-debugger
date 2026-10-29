import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SOUND_SETTINGS,
  SOUND_CUES,
  type SoundCue
} from '@shared/domain/sounds'
import type { SoundSettings } from '@shared/types/settings'
import { createSoundPlayer, SOUND_CUE_URLS, type SoundAudio } from '@/sounds'

interface FakeAudio {
  src: string
  volume: number
  preload: string
  play: () => Promise<void>
  load: () => void
}

function fakeFactory(options: { reject?: boolean } = {}) {
  const created: FakeAudio[] = []
  const createAudio = (src: string): SoundAudio => {
    const audio: FakeAudio = {
      src,
      volume: 1,
      preload: 'none',
      play: vi.fn(() =>
        options.reject ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve()
      ),
      load: vi.fn()
    }
    created.push(audio)
    return audio
  }
  return { created, createAudio }
}

function player(
  settings: Partial<SoundSettings> = {},
  state: { paused?: boolean; quiet?: boolean } = {},
  factory = fakeFactory()
) {
  const instance = createSoundPlayer({
    createAudio: factory.createAudio,
    getSettings: () => ({ ...DEFAULT_SOUND_SETTINGS, ...settings }),
    isPaused: () => state.paused ?? false,
    isQuiet: () => state.quiet ?? false
  })
  return { instance, factory }
}

describe('sound player', () => {
  it('ships a bundled file for every cue', () => {
    for (const cue of SOUND_CUES) {
      expect(SOUND_CUE_URLS[cue]).toMatch(/\.mp3(\?.*)?$/)
    }
    expect(new Set(Object.values(SOUND_CUE_URLS)).size).toBe(SOUND_CUES.length)
  })

  it('plays the mapped file at the configured volume', () => {
    const { instance, factory } = player({ enabled: true, volume: 0.35 })

    expect(instance.play('done')).toBe(true)

    expect(factory.created).toHaveLength(1)
    expect(factory.created[0].src).toBe(SOUND_CUE_URLS.done)
    expect(factory.created[0].volume).toBe(0.35)
    expect(factory.created[0].play).toHaveBeenCalledTimes(1)
  })

  it('creates no audio while the layer is off', () => {
    const { instance, factory } = player({ enabled: false })

    expect(instance.play('popup')).toBe(false)
    expect(factory.created).toHaveLength(0)
  })

  it('creates no audio while paused', () => {
    const { instance, factory } = player({ enabled: true }, { paused: true })

    expect(instance.play('popup')).toBe(false)
    expect(factory.created).toHaveLength(0)
  })

  it('ignores an empty cue instead of guessing one', () => {
    const { instance, factory } = player({ enabled: true })

    expect(instance.play(null)).toBe(false)
    expect(factory.created).toHaveLength(0)
  })

  it('swallows an autoplay rejection so the popup never breaks', async () => {
    const { instance, factory } = player({ enabled: true }, {}, fakeFactory({ reject: true }))

    expect(instance.play('done')).toBe(true)
    expect(factory.created[0].play).toHaveBeenCalledTimes(1)
    await Promise.resolve()
  })

  it('preloads the whole pack without playing it', () => {
    const { instance, factory } = player({ enabled: true })

    instance.preload()

    expect(factory.created).toHaveLength(SOUND_CUES.length)
    for (const audio of factory.created) {
      expect(audio.preload).toBe('auto')
      expect(audio.load).toHaveBeenCalledTimes(1)
      expect(audio.play).not.toHaveBeenCalled()
    }
  })

  it('does not preload while the layer is off', () => {
    const { instance, factory } = player({ enabled: false })

    instance.preload()

    expect(factory.created).toHaveLength(0)
  })
})

// Keep the cue union exercised so a renamed cue fails at compile time.
const _cues: SoundCue[] = [...SOUND_CUES]
void _cues
