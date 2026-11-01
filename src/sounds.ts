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
import { EFFECT_CLIPS, voiceClips, type VoiceClip } from '@/voice-assets'

/** Files of the original shipped pack; used only when a generated take is absent. */
const FALLBACK_CUE_URLS: Record<SoundCue, string> = {
  popup: popupSrc,
  done: doneSrc,
  skip: skipSrc,
  snooze: snoozeSrc,
  'stage-up': stageUpSrc,
  streak: streakSrc,
  alert: alertSrc,
  error: errorSrc
}

/** The newest archived take wins, so a retake replaces the rejected one. */
function generatedCueUrls(): Partial<Record<SoundCue, string>> {
  const urls: Partial<Record<SoundCue, string>> = {}
  for (const cue of SOUND_CUES) {
    const take = EFFECT_CLIPS
      .filter((clip) => clip.event === cue)
      .sort((a, b) => b.take - a.take)[0]
    if (take) urls[cue] = take.url
  }
  return urls
}

/** Generated effect takes ship as the default pack; keys are the stable event ids. */
export const SOUND_CUE_URLS: Record<SoundCue, string> = {
  ...FALLBACK_CUE_URLS,
  ...generatedCueUrls()
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
  /**
   * Durable last-take memory so rotation survives a new popup window. Preview
   * players omit these hooks and keep a private in-memory map only.
   */
  readLastVariant?: (key: string) => string | null
  writeLastVariant?: (key: string, variant: string) => void
}

/**
 * Live reminders and chronicle preview share the popup engine but keep separate
 * durable rotation namespaces (docs/SOUNDS.md). Lab uses its own userData.
 */
export type VoiceRotationScope = 'live' | 'preview'

export function voiceLastStorageKey(scope: VoiceRotationScope = 'live'): string {
  return scope === 'preview' ? 'body-debugger:voice-last:preview' : 'body-debugger:voice-last'
}

function readStoredVoiceLast(scope: VoiceRotationScope, key: string): string | null {
  try {
    const raw = localStorage.getItem(voiceLastStorageKey(scope))
    if (!raw) return null
    const map = JSON.parse(raw) as unknown
    if (!map || typeof map !== 'object') return null
    const value = (map as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

function writeStoredVoiceLast(scope: VoiceRotationScope, key: string, variant: string): void {
  try {
    const storageKey = voiceLastStorageKey(scope)
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) as unknown : {}
    const map = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, string>) }
      : {}
    map[key] = variant
    localStorage.setItem(storageKey, JSON.stringify(map))
  } catch {
    // Storage must never break the popup cycle.
  }
}

export interface VoicePlaybackOptions {
  /** Restrict to one catalogued variant, e.g. the save-failure error line. */
  variant?: string
}

export interface SoundPlayer {
  /** Returns whether a cue was actually started. */
  play: (cue: SoundCue | null | undefined) => boolean
  /**
   * Speak the mapped event. Returns false when the voice layer is off or the
   * character has no take, so the caller can decide about a fallback.
   */
  playVoice: (cue: SoundCue | null | undefined, options?: VoicePlaybackOptions) => boolean
  /** Speak a catalogued event directly, e.g. `active` on the start of the timer. */
  playVoiceEvent: (event: VoiceEvent, options?: VoicePlaybackOptions) => boolean
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
    const event = cue ? VOICE_CUE_EVENTS[cue] : null
    return event ? playVoiceEvent(event, options) : false
  }

  function playVoiceEvent(event: VoiceEvent, options: VoicePlaybackOptions = {}): boolean {
    const settings = audibleSettings()
    if (!settings?.voiceEnabled) return false

    const characterId = deps.getCharacterId?.()
    if (!characterId) return false

    const clips = (deps.resolveVoiceClips ?? voiceClips)(characterId, event)
      .filter((clip) => !options.variant || clip.variant === options.variant)
    if (!clips.length) return false

    const key = `${characterId}#${event}`
    const last = deps.readLastVariant?.(key) ?? lastVariant.get(key) ?? null
    const variant = pickVoiceVariant(clips.map((clip) => clip.variant), last)
    const clip = clips.find((item) => item.variant === variant)
    if (!clip) return false

    lastVariant.set(key, clip.variant)
    deps.writeLastVariant?.(key, clip.variant)
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

  return { play, playVoice, playVoiceEvent, preload }
}

/** Renderer-side player bound to the settings store. */
export function useSoundPlayer(scope: VoiceRotationScope = 'live'): SoundPlayer {
  const settings = useSettingsStore()
  return createSoundPlayer({
    createAudio: (src) => new Audio(src),
    getSettings: () => settings.sound,
    isPaused: () => settings.paused,
    getCharacterId: () => settings.characterPackId,
    readLastVariant: (key) => readStoredVoiceLast(scope, key),
    writeLastVariant: (key, variant) => writeStoredVoiceLast(scope, key, variant)
  })
}
