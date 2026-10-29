/** Session statuses from CONCEPT.md §3 */

export type SessionStatus = 'done' | 'snoozed' | 'skipped' | 'missed'

export type Feeling = 1 | 2 | 3 | 4 | 5

/**
 * Optional details a user may add to a session (CONCEPT.md §4, §10).
 * Every field is optional: the core cycle never depends on them.
 */
export interface SessionExtras {
  reps?: number
  feeling?: Feeling
  weightKg?: number
  photoIds?: string[]
}

export interface Session extends SessionExtras {
  id: string
  exerciseId: string
  status: SessionStatus
  /** Planned or actual duration in seconds */
  durationSec: number
  triggeredAt: string
  completedAt?: string
  skipReason?: string
}
