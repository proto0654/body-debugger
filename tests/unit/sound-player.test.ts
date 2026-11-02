import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SOUND_SETTINGS,
  SOUND_CUES,
  type SoundCue
} from '@shared/domain/sounds'
import type { SoundSettings } from '@shared/types/settings'
import {
  createSoundPlayer,
  SOUND_CUE_URLS,
  VOICE_TAIL_MS,
  voiceLastStorageKey,
  type SoundAudio
} from '@/sounds'

interface FakeAudio {
  src: string
  volume: number
  preload: string
  play: () => Promise<void>
  load: () => void
  pause?: () => void
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
  factory = fakeFactory(),
  voice: {
    characterId?: string
    variants?: Record<string, string[]>
    readLastVariant?: (key: string) => string | null
    writeLastVariant?: (key: string, variant: string) => void
  } = {}
) {
  const instance = createSoundPlayer({
    createAudio: factory.createAudio,
    getSettings: () => ({ ...DEFAULT_SOUND_SETTINGS, ...settings }),
    isPaused: () => state.paused ?? false,
    isQuiet: () => state.quiet ?? false,
    getCharacterId: () => voice.characterId ?? 'desk-hulk',
    resolveVoiceClips: (characterId, event) => (voice.variants?.[event] ?? []).map((variant) => ({
      characterId,
      event,
      variant,
      url: `voice/${characterId}__${event}__${variant}.mp3`
    })),
    readLastVariant: voice.readLastVariant,
    writeLastVariant: voice.writeLastVariant
  })
  return { instance, factory }
}

function memoryVoiceLast() {
  const store = new Map<string, string>()
  return {
    readLastVariant: (key: string) => store.get(key) ?? null,
    writeLastVariant: (key: string, variant: string) => { store.set(key, variant) }
  }
}

describe('sound player', () => {
  it('ships a bundled file for every cue', () => {
    for (const cue of SOUND_CUES) {
      expect(SOUND_CUE_URLS[cue]).toMatch(/\.mp3(\?.*)?$/)
    }
    expect(new Set(Object.values(SOUND_CUE_URLS)).size).toBe(SOUND_CUES.length)
  })

  it('prefers the generated effect take over the shipped default file', () => {
    expect(SOUND_CUE_URLS.done).toMatch(/system__done__01__take-\d+\.mp3/)
    expect(SOUND_CUE_URLS.skip).toMatch(/system__skip__01__take-\d+\.mp3/)
    expect(SOUND_CUE_URLS['stage-up']).toMatch(/system__stage-up__01__take-\d+\.mp3/)
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

  it('waitForPlayback resolves after the current cue ends plus the arcade tail', async () => {
    vi.useFakeTimers()
    const listeners = new Map<string, Array<() => void>>()
    const createAudio = (src: string): SoundAudio => {
      const audio: SoundAudio = {
        src,
        volume: 1,
        preload: 'none',
        duration: 2,
        play: vi.fn(async () => undefined),
        load: vi.fn(),
        pause: vi.fn(),
        addEventListener: (type, listener) => {
          const list = listeners.get(type) ?? []
          list.push(listener)
          listeners.set(type, list)
        },
        removeEventListener: (type, listener) => {
          listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener))
        }
      }
      return audio
    }
    const { instance } = player({ enabled: true }, {}, { created: [], createAudio })
    expect(instance.play('done')).toBe(true)
    const finished = instance.waitForPlayback()
    let done = false
    void finished.then(() => { done = true })
    await Promise.resolve()
    expect(done).toBe(false)
    expect(listeners.get('ended')?.length).toBeGreaterThan(0)
    for (const listener of listeners.get('ended') ?? []) listener()
    await Promise.resolve()
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(VOICE_TAIL_MS)
    await finished
    expect(done).toBe(true)
    vi.useRealTimers()
  })

  it('queues a second cue until the first ends instead of cutting it short', async () => {
    vi.useFakeTimers()
    const ended = new Map<SoundAudio, Array<() => void>>()
    const created: FakeAudio[] = []
    const createAudio = (src: string): SoundAudio => {
      const audio: FakeAudio & SoundAudio = {
        src,
        volume: 1,
        preload: 'none',
        duration: 3,
        play: vi.fn(async () => undefined),
        load: vi.fn(),
        pause: vi.fn(),
        addEventListener: (type, listener) => {
          if (type !== 'ended') return
          const list = ended.get(audio) ?? []
          list.push(listener)
          ended.set(audio, list)
        },
        removeEventListener: (type, listener) => {
          if (type !== 'ended') return
          ended.set(audio, (ended.get(audio) ?? []).filter((item) => item !== listener))
        }
      }
      created.push(audio)
      return audio
    }
    const { instance } = player({ enabled: true }, {}, { created, createAudio })
    expect(instance.play('popup')).toBe(true)
    expect(instance.play('done')).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(created[0]!.play).toHaveBeenCalled()
    expect(created[1]!.play).not.toHaveBeenCalled()
    for (const listener of ended.get(created[0]!) ?? []) listener()
    await vi.advanceTimersByTimeAsync(VOICE_TAIL_MS)
    await Promise.resolve()
    await Promise.resolve()
    expect(created[1]!.play).toHaveBeenCalled()
    expect(created[0]!.pause).not.toHaveBeenCalled()
    vi.useRealTimers()
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

describe('character voice playback', () => {
  it('plays a generated take instead of the effect when the voice layer is on', () => {
    const { instance, factory } = player(
      { enabled: true, voiceEnabled: true, volume: 0.3 },
      {},
      fakeFactory(),
      { variants: { done: ['01', '02'] } }
    )

    expect(instance.playVoice('done')).toBe(true)
    expect(factory.created).toHaveLength(1)
    expect(factory.created[0].src).toBe('voice/desk-hulk__done__01.mp3')
    expect(factory.created[0].volume).toBe(0.3)
  })

  it('speaks a catalogued event directly, outside the cue map', () => {
    const { instance, factory } = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { active: ['01'] } }
    )

    expect(instance.playVoiceEvent('active')).toBe(true)
    expect(factory.created[0].src).toBe('voice/desk-hulk__active__01.mp3')
  })

  it('stays out of the way when the voice layer is off so the caller can fall back', () => {
    const { instance, factory } = player(
      { enabled: true, voiceEnabled: false },
      {},
      fakeFactory(),
      { variants: { done: ['01'] } }
    )

    expect(instance.playVoice('done')).toBe(false)
    expect(factory.created).toHaveLength(0)
    expect(instance.play('done')).toBe(true)
    expect(factory.created).toHaveLength(1)
  })

  it('never repeats the previous take of the same event', () => {
    const { instance, factory } = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { skipped: ['01', '02', '03'] } }
    )

    instance.playVoice('skip')
    instance.playVoice('skip')
    instance.playVoice('skip')
    instance.playVoice('skip')

    expect(factory.created.map((audio) => audio.src)).toEqual([
      'voice/desk-hulk__skipped__01.mp3',
      'voice/desk-hulk__skipped__02.mp3',
      'voice/desk-hulk__skipped__03.mp3',
      'voice/desk-hulk__skipped__01.mp3'
    ])
  })

  it('continues rotation across fresh player instances that share durable storage', () => {
    const memory = memoryVoiceLast()
    const first = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { done: ['01', '02', '03'] }, ...memory }
    )
    const second = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { done: ['01', '02', '03'] }, ...memory }
    )

    expect(first.instance.playVoice('done')).toBe(true)
    expect(second.instance.playVoice('done')).toBe(true)
    expect(second.instance.playVoice('done')).toBe(true)

    expect(first.factory.created.map((audio) => audio.src)).toEqual([
      'voice/desk-hulk__done__01.mp3'
    ])
    expect(second.factory.created.map((audio) => audio.src)).toEqual([
      'voice/desk-hulk__done__02.mp3',
      'voice/desk-hulk__done__03.mp3'
    ])
  })

  it('restarts from the first take when a new player has no durable storage', () => {
    const first = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { ready: ['01', '02'] } }
    )
    const second = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { ready: ['01', '02'] } }
    )

    expect(first.instance.playVoice('popup')).toBe(true)
    expect(second.instance.playVoice('popup')).toBe(true)
    expect(first.factory.created[0].src).toBe('voice/desk-hulk__ready__01.mp3')
    expect(second.factory.created[0].src).toBe('voice/desk-hulk__ready__01.mp3')
  })

  it('keeps live and preview rotation namespaces from mixing', () => {
    expect(voiceLastStorageKey('live')).toBe('body-debugger:voice-last')
    expect(voiceLastStorageKey('preview')).toBe('body-debugger:voice-last:preview')

    const live = memoryVoiceLast()
    const preview = memoryVoiceLast()
    const livePlayer = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { done: ['01', '02'] }, ...live }
    )
    const previewPlayer = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { done: ['01', '02'] }, ...preview }
    )

    expect(livePlayer.instance.playVoice('done')).toBe(true)
    expect(previewPlayer.instance.playVoice('done')).toBe(true)
    expect(livePlayer.factory.created[0].src).toBe('voice/desk-hulk__done__01.mp3')
    expect(previewPlayer.factory.created[0].src).toBe('voice/desk-hulk__done__01.mp3')

    expect(livePlayer.instance.playVoice('done')).toBe(true)
    expect(livePlayer.factory.created[1].src).toBe('voice/desk-hulk__done__02.mp3')
    expect(previewPlayer.instance.playVoice('done')).toBe(true)
    expect(previewPlayer.factory.created[1].src).toBe('voice/desk-hulk__done__02.mp3')
  })

  it('honours an explicit variant for the save-failure error line', () => {
    const { instance, factory } = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { error: ['01', '02'] } }
    )

    expect(instance.playVoice('error', { variant: '01' })).toBe(true)
    expect(instance.playVoice('error', { variant: '02' })).toBe(true)
    expect(factory.created.map((audio) => audio.src)).toEqual([
      'voice/desk-hulk__error__01.mp3',
      'voice/desk-hulk__error__02.mp3'
    ])
  })

  it('reports no voice when the character has no take for the event', () => {
    const { instance, factory } = player(
      { enabled: true, voiceEnabled: true },
      {},
      fakeFactory(),
      { variants: { done: ['01'] } }
    )

    expect(instance.playVoice('popup')).toBe(false)
    expect(factory.created).toHaveLength(0)
  })

  it('respects mute and pause exactly like the effect layer', () => {
    const muted = player({ enabled: false, voiceEnabled: true }, {}, fakeFactory(), { variants: { done: ['01'] } })
    expect(muted.instance.playVoice('done')).toBe(false)
    expect(muted.factory.created).toHaveLength(0)

    const paused = player({ enabled: true, voiceEnabled: true }, { paused: true }, fakeFactory(), { variants: { done: ['01'] } })
    expect(paused.instance.playVoice('done')).toBe(false)
    expect(paused.factory.created).toHaveLength(0)
  })
})

// Keep the cue union exercised so a renamed cue fails at compile time.
const _cues: SoundCue[] = [...SOUND_CUES]
void _cues
