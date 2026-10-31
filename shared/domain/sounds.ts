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

/** Packs shipped with the app. Theme packs can extend this list later. */
export const SOUND_PACK_IDS = ['default'] as const

export type SoundPackId = (typeof SOUND_PACK_IDS)[number]

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.4,
  packId: 'default'
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
    packId: isSoundPackId(stored.packId) ? stored.packId : DEFAULT_SOUND_SETTINGS.packId
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
