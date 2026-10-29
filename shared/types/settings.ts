import type { UserFocus } from './progress'
import type { WeightSettings } from './weight'

/** Fixation severity from CONCEPT.md §3 */
export type SeverityLevel = 'soft' | 'medium' | 'hardcore'

export type ExercisePickerMode = 'balance' | 'rotation' | 'focus' | 'push'

export interface InventorySettings {
  enabled: boolean
  /** Equipment ids the user has (optional layer) */
  items: string[]
}

export interface SessionExtrasSettings {
  /** Show the optional details block (reps / feeling / weight) in the popup */
  enabled: boolean
}

/** Optional sound layer (docs/SOUNDS.md). */
/** Optional AI proposal layer (CONCEPT.md §9); off = no panel, no imports. */
export interface AiSettings {
  enabled: boolean
}

/** Optional progress-photo layer (CONCEPT.md §10). */
export interface PhotoSettings {
  enabled: boolean
}

export interface SoundSettings {
  /** Master switch; off by default so the core cycle stays silent */
  enabled: boolean
  /** 0..1 */
  volume: number
  /** Shipped cue pack id */
  packId: string
}

export interface AppSettings {
  severity: SeverityLevel
  /** Minutes between triggers (counted from last session completion) */
  intervalMinutes: number
  focus: UserFocus
  pickerMode: ExercisePickerMode
  inventory: InventorySettings
  sessionExtras: SessionExtrasSettings
  ai: AiSettings
  photos: PhotoSettings
  sound: SoundSettings
  weight: WeightSettings
  themeId: string
  characterPackId: string
  reduceMotion: boolean
  /** Pause reminders without quitting */
  paused: boolean
}
