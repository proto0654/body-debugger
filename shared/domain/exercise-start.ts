import type { Exercise } from '../types/exercise'
import type { ExerciseV2Resolved } from '../types/exercise-v2'
import type { AppSettings } from '../types/settings'
import { explainPick, type FilterReason } from './picker'
import { dose } from './dose'

export interface ExerciseRecommendation {
  exercise: Exercise
  token: string
}

export type StartExerciseRequest =
  | { source: 'recommendation'; token: string }
  | { source: 'catalog'; exerciseId: string }

export type StartExerciseResult =
  | { status: 'started' | 'focused' }
  | { status: 'blocked' | 'unavailable' | 'stale'; message: string }

const FILTER_MESSAGES: Record<FilterReason, string> = {
  inventory: 'Для упражнения нужен инвентарь, которого нет в вашем профиле.',
  intensityCap: 'Нагрузка не подходит текущему интервалу перерывов.',
  avoidIf: 'Упражнение исключено вашими ограничениями.',
  context: 'Упражнение не подходит условиям выполнения.',
  archived: 'Упражнение находится в архиве.'
}

/** The same hard filters are used by the picker and explicit manual starts. */
export function exerciseUnavailableReason(exercise: ExerciseV2Resolved, settings: AppSettings): string | null {
  const candidate = explainPick({ catalog: [exercise], recentSessions: [], settings }, 1).candidates[0]
  return candidate?.filteredBy ? FILTER_MESSAGES[candidate.filteredBy] : null
}

export function plannedExerciseSeconds(exercise: ExerciseV2Resolved, settings: AppSettings): number {
  return dose(exercise.timer, settings.intervalMinutes, settings.overrides[exercise.id]?.scale ?? 1)
}
