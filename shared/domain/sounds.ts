import type { SessionStatus } from '../types/session'
import type { SoundSettings } from '../types/settings'

/** Every cue documented in docs/SOUNDS.md. */
export const SOUND_CUES = [
  'popup',
  'done',
  'skip',
  'snooze',
  'stage-up',
  'streak',
  'alert',
  'error'
] as const

export type SoundCue = (typeof SOUND_CUES)[number]
export const SOUND_CUE_LABELS: Record<SoundCue, string> = {
  popup: 'Напоминание', done: 'Выполнено', skip: 'Пропуск', snooze: 'Отложено',
  'stage-up': 'Новая форма', streak: 'Серия', alert: 'Внимание', error: 'Ошибка'
}

/**
 * Spoken events of the character voice package (docs/AUDIO-PRODUCTION.md). The
 * catalog owns the lines; this list only fixes the order and the UI labels.
 */
export const VOICE_EVENTS = [
  'ready', 'done', 'first-done', 'stage-up', 'streak', 'welcome',
  'active', 'paused', 'skipped', 'snoozed', 'error', 'alert'
] as const

export type VoiceEvent = (typeof VOICE_EVENTS)[number]

export const VOICE_EVENT_LABELS: Record<VoiceEvent, string> = {
  ready: 'Напоминание', done: 'Выполнено', 'first-done': 'Первое за день',
  'stage-up': 'Новая форма', streak: 'Серия', welcome: 'Приветствие',
  active: 'Старт', paused: 'Пауза', skipped: 'Пропуск', snoozed: 'Отложено',
  error: 'Ошибка', alert: 'Внимание'
}

/** One principal voice clip per cue; the effect remains the fallback. */
export const VOICE_CUE_EVENTS: Record<SoundCue, VoiceEvent | null> = {
  popup: 'ready',
  done: 'done',
  skip: 'skipped',
  snooze: 'snoozed',
  'stage-up': 'stage-up',
  streak: 'streak',
  alert: 'alert',
  error: 'error'
}

export function isVoiceEvent(value: unknown): value is VoiceEvent {
  return typeof value === 'string' && (VOICE_EVENTS as readonly string[]).includes(value)
}

/**
 * Rotate through the variants of one event so the same take never plays twice in
 * a row; an unknown previous variant restarts the rotation (docs/AUDIO-PRODUCTION.md
 * requires stable event identity without immediate repeats).
 */
export function pickVoiceVariant(variants: readonly string[], last: string | null): string | null {
  if (!variants.length) return null
  const index = last === null ? -1 : variants.indexOf(last)
  return variants[(index + 1) % variants.length] ?? null
}

/** Packs shipped with the app. Theme packs can extend this list later. */
export const SOUND_PACK_IDS = ['default'] as const

export type SoundPackId = (typeof SOUND_PACK_IDS)[number]

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.4,
  packId: 'default',
  voiceEnabled: true
}

export function isSoundPackId(value: unknown): value is SoundPackId {
  return typeof value === 'string' && (SOUND_PACK_IDS as readonly string[]).includes(value)
}

/**
 * Sound settings are stored with the rest of `AppSettings`; an older file has no
 * `sound` block, and a hand-edited file may carry nonsense. Volume is a slider,
 * so out-of-range numbers clamp instead of being dropped.
 */
export function normalizeSoundSettings(
  stored: Partial<SoundSettings> | null | undefined
): SoundSettings {
  // A missing block in a legacy profile preserves the former muted default.
  if (!stored) return { ...DEFAULT_SOUND_SETTINGS, enabled: false }

  const volume =
    typeof stored.volume === 'number' && Number.isFinite(stored.volume)
      ? Math.min(1, Math.max(0, stored.volume))
      : DEFAULT_SOUND_SETTINGS.volume

  return {
    enabled: stored.enabled === true,
    volume,
    packId: isSoundPackId(stored.packId) ? stored.packId : DEFAULT_SOUND_SETTINGS.packId,
    // The generated voice is the default experience; only an explicit opt-out
    // keeps it silent on an existing profile.
    voiceEnabled: stored.voiceEnabled !== false
  }
}

/** A resolved session maps to one cue; `missed` is not a user action. */
export function cueForSessionStatus(status: SessionStatus): SoundCue | null {
  if (status === 'done') return 'done'
  if (status === 'skipped') return 'skip'
  if (status === 'snoozed') return 'snooze'
  return null
}

export interface SoundContext {
  /** Reminders are paused (settings.paused). */
  paused?: boolean
  /** OS do-not-disturb / call mode; callers pass it when they can detect it. */
  quiet?: boolean
}

/** SOUNDS.md principles 1, 2 and 4: master switch, volume and silence on pause / DND. */
export function canPlayCue(settings: SoundSettings, context: SoundContext = {}): boolean {
  if (!settings.enabled) return false
  if (!(settings.volume > 0)) return false
  if (context.paused) return false
  if (context.quiet) return false
  return true
}
