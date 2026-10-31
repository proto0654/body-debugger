import doneSrc from '@/assets/sounds/default/done.mp3?url'
import alertSrc from '@/assets/sounds/default/alert.mp3?url'
import errorSrc from '@/assets/sounds/default/error.mp3?url'
import popupSrc from '@/assets/sounds/default/popup.mp3?url'
import skipSrc from '@/assets/sounds/default/skip.mp3?url'
import snoozeSrc from '@/assets/sounds/default/snooze.mp3?url'
import stageUpSrc from '@/assets/sounds/default/stage-up.mp3?url'
import streakSrc from '@/assets/sounds/default/streak.mp3?url'
import {
  SOUND_CUES,
  VOICE_CUE_EVENTS,
  canPlayCue,
  pickVoiceVariant,
  type SoundCue,
  type VoiceEvent
} from '@shared/domain/sounds'
import type { SoundSettings } from '@shared/types/settings'
import { useSettingsStore } from '@/stores/settings'
import { voiceClips, type VoiceClip } from '@/voice-assets'

/** Bundled files of the shipped pack; keys are the stable event ids. */
export const SOUND_CUE_URLS: Record<SoundCue, string> = {
  popup: popupSrc,
  done: doneSrc,
  skip: skipSrc,
  snooze: snoozeSrc,
  'stage-up': stageUpSrc,
  streak: streakSrc,
  alert: alertSrc,
  error: errorSrc
}

/** The subset of HTMLAudioElement playback needs, injectable for tests. */
export interface SoundAudio {
  src?: string
  volume: number
  preload: string
  play: () => Promise<void>
  load: () => void
}

export interface SoundPlayerDeps {
  createAudio: (src: string) => SoundAudio
  getSettings: () => SoundSettings
  isPaused?: () => boolean
  isQuiet?: () => boolean
  /** Identity whose voice package is spoken; the pack id is the character id. */
  getCharacterId?: () => string
  /** Variants of one spoken event; injectable for tests. */
  resolveVoiceClips?: (characterId: string, event: VoiceEvent) => readonly VoiceClip[]
}

export interface VoicePlaybackOptions {
  /** Restrict to one catalogued variant, e.g. the save-failure error line. */
  variant?: string
}

export interface SoundPlayer {
  /** Returns whether a cue was actually started. */
  play: (cue: SoundCue | null | undefined) => boolean
  /**
   * Speak the mapped event instead of the plain cue. Returns false when the voice
   * layer is off or the character has no take, so the caller can fall back.
   */
  playVoice: (cue: SoundCue | null | undefined, options?: VoicePlaybackOptions) => boolean
  /** Warm the pack so the first cue is not delayed by decoding. */
  preload: () => void
}

/**
 * Optional sound layer (docs/SOUNDS.md): short cues only, gated by the master
 * switch, volume, pause and DND. Playback failures are logged and swallowed —
 * audio must never break the popup or the core cycle.
 */
export function createSoundPlayer(deps: SoundPlayerDeps): SoundPlayer {
  const lastVariant = new Map<string, string>()

  function audibleSettings(): SoundSettings | null {
    const settings = deps.getSettings()
    return canPlayCue(settings, {
      paused: deps.isPaused?.() ?? false,
      quiet: deps.isQuiet?.() ?? false
    })
      ? settings
      : null
  }

  function start(settings: SoundSettings, url: string, label: string): void {
    const audio = deps.createAudio(url)
    audio.volume = settings.volume
    void audio.play().catch((error: unknown) => {
      console.warn('[sounds] cue could not start', label, error)
    })
  }

  function play(cue: SoundCue | null | undefined): boolean {
    if (!cue) return false
    const settings = audibleSettings()
    if (!settings) return false

    start(settings, SOUND_CUE_URLS[cue], cue)
    return true
  }

  function playVoice(cue: SoundCue | null | undefined, options: VoicePlaybackOptions = {}): boolean {
    if (!cue) return false
    const settings = audibleSettings()
    if (!settings?.voiceEnabled) return false

    const event = VOICE_CUE_EVENTS[cue]
    const characterId = deps.getCharacterId?.()
    if (!event || !characterId) return false

    const clips = (deps.resolveVoiceClips ?? voiceClips)(characterId, event)
      .filter((clip) => !options.variant || clip.variant === options.variant)
    if (!clips.length) return false

    const key = `${characterId}#${event}`
    const variant = pickVoiceVariant(clips.map((clip) => clip.variant), lastVariant.get(key) ?? null)
    const clip = clips.find((item) => item.variant === variant)
    if (!clip) return false

    lastVariant.set(key, clip.variant)
    start(settings, clip.url, `${characterId}/${event}/${clip.variant}`)
    return true
  }

  function preload(): void {
    if (!deps.getSettings().enabled) return

    for (const cue of SOUND_CUES) {
      const audio = deps.createAudio(SOUND_CUE_URLS[cue])
      audio.preload = 'auto'
      audio.load()
    }
  }

  return { play, playVoice, preload }
}

/** Renderer-side player bound to the settings store. */
export function useSoundPlayer(): SoundPlayer {
  const settings = useSettingsStore()
  return createSoundPlayer({
    createAudio: (src) => new Audio(src),
    getSettings: () => settings.sound,
    isPaused: () => settings.paused,
    getCharacterId: () => settings.characterPackId
  })
}
