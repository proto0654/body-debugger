import type { SeverityLevel } from '../types/settings'

/**
 * Fixation severity rules (CONCEPT.md §3).
 *
 * - soft     — «Готово» доступно сразу, таймер только подсказывает.
 * - medium   — «Готово» открывается ближе к концу упражнения.
 * - hardcore — как medium, плюс удержание кнопки для подтверждения.
 *
 * Closing the popup without an answer is `skipped` in main, for every level.
 */

export const SEVERITY_ORDER: SeverityLevel[] = ['soft', 'medium', 'hardcore']

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  soft: 'Мягкая',
  medium: 'Средняя',
  hardcore: 'Жёсткая'
}

/** Share of the exercise timer after which «Готово» unlocks (medium / hardcore). */
export const DONE_UNLOCK_RATIO = 0.8

/** How long the confirm button must be held on hardcore. */
export const HOLD_CONFIRM_MS = 1_500

export function canFinish(
  severity: SeverityLevel,
  remainingMs: number,
  durationMs: number
): boolean {
  if (severity === 'soft') return true
  if (durationMs <= 0) return true
  const elapsedMs = durationMs - Math.max(remainingMs, 0)
  return elapsedMs >= durationMs * DONE_UNLOCK_RATIO
}

/** `mm:ss` countdown label. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(remainingMs, 0) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
