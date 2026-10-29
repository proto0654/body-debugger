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
  canPlayCue,
  type SoundCue
} from '@shared/domain/sounds'
import type { SoundSettings } from '@shared/types/settings'
import { useSettingsStore } from '@/stores/settings'

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
}

export interface SoundPlayer {
  /** Returns whether a cue was actually started. */
  play: (cue: SoundCue | null | undefined) => boolean
  /** Warm the pack so the first cue is not delayed by decoding. */
  preload: () => void
}

/**
 * Optional sound layer (docs/SOUNDS.md): short cues only, gated by the master
 * switch, volume, pause and DND. Playback failures are logged and swallowed —
 * audio must never break the popup or the core cycle.
 */
export function createSoundPlayer(deps: SoundPlayerDeps): SoundPlayer {
  function audibleSettings(): SoundSettings | null {
    const settings = deps.getSettings()
    return canPlayCue(settings, {
      paused: deps.isPaused?.() ?? false,
      quiet: deps.isQuiet?.() ?? false
    })
      ? settings
      : null
  }

  function play(cue: SoundCue | null | undefined): boolean {
    if (!cue) return false
    const settings = audibleSettings()
    if (!settings) return false

    const audio = deps.createAudio(SOUND_CUE_URLS[cue])
    audio.volume = settings.volume
    void audio.play().catch((error: unknown) => {
      console.warn('[sounds] cue could not start', cue, error)
    })
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

  return { play, preload }
}

/** Renderer-side player bound to the settings store. */
export function useSoundPlayer(): SoundPlayer {
  const settings = useSettingsStore()
  return createSoundPlayer({
    createAudio: (src) => new Audio(src),
    getSettings: () => settings.sound,
    isPaused: () => settings.paused
  })
}
