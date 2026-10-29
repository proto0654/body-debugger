import type { Session, SessionStatus } from '../types/session'
import { normalizeSessionExtras } from '../domain/session-extras'

/**
 * Session records arrive from IPC (and, in debug mode, from the scenario panel),
 * so they are validated like any other external payload before they reach the
 * main-owned snapshot.
 */

const STATUSES: readonly SessionStatus[] = ['done', 'snoozed', 'skipped', 'missed']

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoTimestamp(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function hasValidExtras(entry: Record<string, unknown>): boolean {
  const normalized = normalizeSessionExtras({
    reps: entry.reps,
    feeling: entry.feeling,
    weightKg: entry.weightKg
  })

  if (entry.reps !== undefined && normalized.reps !== entry.reps) return false
  if (entry.feeling !== undefined && normalized.feeling !== entry.feeling) return false
  if (entry.weightKg !== undefined && normalized.weightKg !== entry.weightKg) return false
  return true
}

export function isValidSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>

  if (!isNonEmptyString(entry.id)) return false
  if (!isNonEmptyString(entry.exerciseId)) return false
  if (!STATUSES.includes(entry.status as SessionStatus)) return false
  if (
    typeof entry.durationSec !== 'number' ||
    !Number.isFinite(entry.durationSec) ||
    entry.durationSec < 0
  ) {
    return false
  }
  if (!isIsoTimestamp(entry.triggeredAt)) return false
  if (entry.completedAt !== undefined && !isIsoTimestamp(entry.completedAt)) return false
  if (entry.skipReason !== undefined && !isNonEmptyString(entry.skipReason)) return false
  if (!hasValidExtras(entry)) return false

  if (entry.photoIds !== undefined) {
    if (
      !Array.isArray(entry.photoIds) ||
      !entry.photoIds.every((id) => typeof id === 'string' && id.length > 0)
    ) {
      return false
    }
  }

  return true
}

/** Filter an untrusted list, keeping only valid sessions (copies, not aliases). */
export function sanitizeSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return []
  return value.filter(isValidSession).map((session) => ({
    ...session,
    ...(session.photoIds ? { photoIds: [...session.photoIds] } : {})
  }))
}
