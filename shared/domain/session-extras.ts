import type { Feeling, SessionExtras } from '../types/session'

/**
 * Optional session details (CONCEPT.md §4, §10): reps, feeling, weight.
 *
 * Anything that arrives over IPC is untrusted — values outside the documented
 * ranges are dropped instead of being clamped, so a bad payload never writes a
 * misleading measurement. The core cycle keeps working with an empty result.
 */

export const REPS_RANGE = { min: 1, max: 999 } as const
export const WEIGHT_KG_RANGE = { min: 20, max: 300 } as const
export const FEELING_RANGE = { min: 1, max: 5 } as const

export const FEELING_VALUES: readonly Feeling[] = [1, 2, 3, 4, 5]

export const FEELING_LABELS: Record<Feeling, string> = {
  1: 'Тяжело',
  2: 'Слабо',
  3: 'Норм',
  4: 'Хорошо',
  5: 'Легко'
}

export interface SessionExtrasInput {
  reps?: unknown
  feeling?: unknown
  weightKg?: unknown
}

/** Parses a finite number from a number or a numeric string; null otherwise. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (trimmed === '') return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** Weight is stored with one decimal, matching the input step. */
export function roundWeightKg(value: number): number {
  return Math.round(value * 10) / 10
}

export function normalizeSessionExtras(input: SessionExtrasInput): SessionExtras {
  const extras: SessionExtras = {}

  const reps = toNumber(input.reps)
  if (reps !== null && Number.isInteger(reps) && reps >= REPS_RANGE.min && reps <= REPS_RANGE.max) {
    extras.reps = reps
  }

  const feeling = toNumber(input.feeling)
  if (
    feeling !== null &&
    Number.isInteger(feeling) &&
    feeling >= FEELING_RANGE.min &&
    feeling <= FEELING_RANGE.max
  ) {
    extras.feeling = feeling as Feeling
  }

  const weightKg = toNumber(input.weightKg)
  if (weightKg !== null && weightKg >= WEIGHT_KG_RANGE.min && weightKg <= WEIGHT_KG_RANGE.max) {
    extras.weightKg = roundWeightKg(weightKg)
  }

  return extras
}
