import type { UserFocus } from './progress'

/** Fixation severity from CONCEPT.md §3 */
export type SeverityLevel = 'soft' | 'medium' | 'hardcore'

export type ExercisePickerMode = 'balance' | 'rotation' | 'focus' | 'push'

export interface InventorySettings {
  enabled: boolean
  /** Equipment ids the user has (optional layer) */
  items: string[]
}

export interface AppSettings {
  severity: SeverityLevel
  /** Minutes between triggers (counted from last session completion) */
  intervalMinutes: number
  focus: UserFocus
  pickerMode: ExercisePickerMode
  inventory: InventorySettings
  themeId: string
  characterPackId: string
  reduceMotion: boolean
  /** Pause reminders without quitting */
  paused: boolean
}
