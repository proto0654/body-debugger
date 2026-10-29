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

export interface AppSettings {
  severity: SeverityLevel
  /** Minutes between triggers (counted from last session completion) */
  intervalMinutes: number
  focus: UserFocus
  pickerMode: ExercisePickerMode
  inventory: InventorySettings
  sessionExtras: SessionExtrasSettings
  weight: WeightSettings
  themeId: string
  characterPackId: string
  reduceMotion: boolean
  /** Pause reminders without quitting */
  paused: boolean
}
