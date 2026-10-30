import type { FocusDirection } from '../types/progress'

/** CONCEPT.md §6 directions, in display order. */
export const FOCUS_DIRECTIONS: readonly FocusDirection[] = [
  'mobility',
  'light_athletics',
  'strength',
  'body_belts',
  'striking',
  'balance'
]

export const FOCUS_LABELS: Record<FocusDirection, string> = {
  mobility: 'Растяжки и йога',
  light_athletics: 'Лёгкая атлетика',
  strength: 'Силовая',
  body_belts: 'Пояса и части тела',
  striking: 'Ударка',
  balance: 'Баланс'
}

export function isFocusDirection(value: unknown): value is FocusDirection {
  return typeof value === 'string' && (FOCUS_DIRECTIONS as readonly string[]).includes(value)
}
