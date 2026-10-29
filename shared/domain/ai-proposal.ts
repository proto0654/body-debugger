import { isValidExercise } from '../validation/exercise'
import type { Exercise } from '../types/exercise'

/**
 * AI proposal boundary (CONCEPT.md §9).
 *
 * The app does not call a model itself: the user pastes an AI answer, which must
 * decode to one valid Exercise. Nothing enters the catalog until the user
 * explicitly approves it, and a shipped id can never be replaced.
 */

export type ProposalError = 'empty' | 'invalid-json' | 'invalid-exercise'

export interface ProposalParseResult {
  exercise: Exercise | null
  error: ProposalError | null
}

function extractObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return body.slice(start, end + 1)
}

export function parseExerciseProposal(value: unknown): ProposalParseResult {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length === 0) return { exercise: null, error: 'empty' }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : text).trim()
  if (body.startsWith('[')) return { exercise: null, error: 'invalid-exercise' }

  const json = extractObject(text)
  if (!json) return { exercise: null, error: 'invalid-json' }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { exercise: null, error: 'invalid-json' }
  }

  if (!isValidExercise(parsed)) return { exercise: null, error: 'invalid-exercise' }
  return { exercise: parsed, error: null }
}

export interface ApprovalCheck {
  ok: boolean
  reason: 'duplicate-id' | null
}

/** Shipped and already-approved ids are taken; never overwrite an exercise. */
export function canApproveExercise(exercise: Exercise, existingIds: Iterable<string>): ApprovalCheck {
  const taken = new Set(Array.from(existingIds))
  return taken.has(exercise.id) ? { ok: false, reason: 'duplicate-id' } : { ok: true, reason: null }
}

/** Shipped catalog wins on id conflicts; custom entries append in approval order. */
export function mergeCatalogs(base: readonly Exercise[], custom: readonly Exercise[]): Exercise[] {
  const merged = [...base]
  const seen = new Set(base.map((exercise) => exercise.id))

  for (const exercise of custom) {
    if (!isValidExercise(exercise) || seen.has(exercise.id)) continue
    seen.add(exercise.id)
    merged.push(exercise)
  }
  return merged
}
