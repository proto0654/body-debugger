import type { UserFocus } from './progress'
import type { WeightSettings } from './weight'
import type {
  AutoTuneMode,
  ExerciseOverride,
  FocusV2,
  Limitation,
  LlmSettings,
  ProfileShift,
  ScaleHistoryEntry
} from './exercise-v2'

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
  /** Speak the selected character's voice package instead of the plain cue */
  voiceEnabled: boolean
}

export interface AppSettings {
  severity: SeverityLevel
  /** Minutes between triggers (counted from last session completion) */
  intervalMinutes: number
  /** Legacy Focus (primary + accents); kept for migration and v1 UI until fully replaced. */
  focus: UserFocus
  /** Two-axis Focus (zones × methods). */
  focusV2: FocusV2
  /** Profile strength λ in [0, 1]; default 0.7. */
  profileStrength: number
  profileShifts: ProfileShift[]
  limitations: Limitation[]
  overrides: Record<string, ExerciseOverride>
  /** Recent personal-dose accepts (newest first). */
  scaleHistory: ScaleHistoryEntry[]
  autoTune: AutoTuneMode
  llm: LlmSettings
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
