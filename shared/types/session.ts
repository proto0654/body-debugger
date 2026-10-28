/** Session statuses from CONCEPT.md §3 */

export type SessionStatus = 'done' | 'snoozed' | 'skipped' | 'missed'

export type Feeling = 1 | 2 | 3 | 4 | 5

export interface Session {
  id: string
  exerciseId: string
  status: SessionStatus
  /** Planned or actual duration in seconds */
  durationSec: number
  triggeredAt: string
  completedAt?: string
  /** Optional layers — never required by the core cycle */
  reps?: number
  feeling?: Feeling
  weightKg?: number
  photoIds?: string[]
  skipReason?: string
}
