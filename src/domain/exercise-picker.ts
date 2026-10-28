import type { Exercise } from '@shared/types/exercise'
import type { Session } from '@shared/types/session'
import type { AppSettings } from '@shared/types/settings'
import type { UserProgress } from '@shared/types/progress'

/**
 * Exercise selection rules live HERE (CONCEPT.md §7).
 *
 * Planned:
 * - Penalty for previous session group/category
 * - Penalty for exercises already done today
 * - Bonus for neglected zones
 * - Bonuses from UserFocus (settings.focus)
 * - Inventory + exercise level awareness
 * - Modes: balance | rotation | focus | push
 *
 * Preferences shift weights; they must not cancel zone rotation.
 * Not implemented in the skeleton — returns a placeholder exercise.
 */

export interface PickerContext {
  catalog: Exercise[]
  recentSessions: Session[]
  progress: UserProgress
  settings: AppSettings
  now?: Date
}

const PLACEHOLDER: Exercise = {
  id: 'placeholder-neck-rolls',
  title: 'Круги головой',
  description: 'Медленно покрутите головой по часовой и против — разминка шеи.',
  durationSec: 45,
  difficulty: 1,
  category: 'neck',
  group: 'upper',
  emojiFallback: '🧘'
}

export function pickNextExercise(_ctx: PickerContext): Exercise {
  // TODO: weighted scoring from CONCEPT §7
  return PLACEHOLDER
}
