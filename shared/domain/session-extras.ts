import type { Feeling, SessionExtras } from '../types/session'
import { parseFiniteNumber } from './parse-number'
import { normalizeWeightEntry } from './weight'

/**
 * Optional session details (CONCEPT.md §4, §10): reps, feeling, weight.
 *
 * Anything that arrives over IPC is untrusted — values outside the documented
 * ranges are dropped instead of being clamped, so a bad payload never writes a
 * misleading measurement. The core cycle keeps working with an empty result.
 */

export const REPS_RANGE = { min: 1, max: 999 } as const
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

export function normalizeSessionExtras(input: SessionExtrasInput): SessionExtras {
  const extras: SessionExtras = {}

  const reps = parseFiniteNumber(input.reps)
  if (reps !== null && Number.isInteger(reps) && reps >= REPS_RANGE.min && reps <= REPS_RANGE.max) {
    extras.reps = reps
  }

  const feeling = parseFiniteNumber(input.feeling)
  if (
    feeling !== null &&
    Number.isInteger(feeling) &&
    feeling >= FEELING_RANGE.min &&
    feeling <= FEELING_RANGE.max
  ) {
    extras.feeling = feeling as Feeling
  }

  // Weight rules (range + rounding) live in `shared/domain/weight.ts`.
  const weight = normalizeWeightEntry({ weightKg: input.weightKg })
  if (weight) extras.weightKg = weight.weightKg

  return extras
}

