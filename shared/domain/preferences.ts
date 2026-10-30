import { isFocusDirection } from '../constants/focus'
import type { FocusDirection, UserFocus } from '../types/progress'
import type { ExercisePickerMode } from '../types/settings'

/**
 * Core preference rules (CONCEPT.md §6–7): reminder interval, picker mode and
 * Focus. Pure functions shared by the dashboard and the JSON loader.
 */

export const DEFAULT_INTERVAL_MINUTES = 45
export const DEFAULT_PICKER_MODE: ExercisePickerMode = 'balance'

/** Below 5 min the app nags; above 4 h it stops being a reminder. */
export const INTERVAL_MINUTES_MIN = 5
export const INTERVAL_MINUTES_MAX = 240

/** Quick choices on the settings screen; every preset sits inside the bounds. */
export const INTERVAL_PRESETS: readonly number[] = [15, 30, 45, 60, 90]

/**
 * Whole minutes inside the bounds, or `null` when the value is unusable.
 * Out-of-range input is rejected, not clamped (same rule as the weight goal).
 */
export function normalizeIntervalMinutes(value: unknown): number | null {
  const minutes = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(minutes)) return null

  const rounded = Math.round(minutes)
  if (rounded < INTERVAL_MINUTES_MIN || rounded > INTERVAL_MINUTES_MAX) return null
  return rounded
}

export const PICKER_MODES: readonly ExercisePickerMode[] = ['balance', 'rotation', 'focus', 'push']

export const PICKER_MODE_LABELS: Record<ExercisePickerMode, string> = {
  balance: 'Баланс',
  rotation: 'Ротация',
  focus: 'Фокус',
  push: 'Дожим'
}

export const PICKER_MODE_HINTS: Record<ExercisePickerMode, string> = {
  balance: 'Ровное чередование зон и групп.',
  rotation: 'Не повторять категорию прошлой сессии.',
  focus: 'Сильнее тянуть к выбранным направлениям.',
  push: 'Дожимать самую запущенную зону.'
}

export function isPickerMode(value: unknown): value is ExercisePickerMode {
  return typeof value === 'string' && (PICKER_MODES as readonly string[]).includes(value)
}

/**
 * Known directions only; accents stay unique and never repeat the primary.
 * Unknown values are dropped, so a stale or hand-edited file cannot smuggle them in.
 */
export function normalizeFocus(primary: unknown, accents: unknown): UserFocus {
  const nextPrimary = isFocusDirection(primary) ? primary : null
  const nextAccents: FocusDirection[] = []

  for (const accent of Array.isArray(accents) ? accents : []) {
    if (!isFocusDirection(accent) || accent === nextPrimary) continue
    if (!nextAccents.includes(accent)) nextAccents.push(accent)
  }

  return { primary: nextPrimary, accents: nextAccents }
}

export function isSameFocus(left: UserFocus, right: UserFocus): boolean {
  return (
    left.primary === right.primary &&
    left.accents.length === right.accents.length &&
    left.accents.every((accent, index) => accent === right.accents[index])
  )
}
