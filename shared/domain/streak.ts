import { nowDate } from './clock'
import type { Session } from '../types/session'
import type { Streak } from '../types/progress'

/**
 * Day-based streak (CONCEPT.md §5): one point per calendar day with at least one
 * done session. The current run may end today or yesterday; anything older is a
 * broken streak. Max keeps the longest run ever recorded.
 */

const DAY_MS = 86_400_000

function dayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}

function doneDayIndexes(sessions: readonly Session[]): Set<number> {
  const days = new Set<number>()
  for (const session of sessions) {
    if (session.status !== 'done') continue
    const parsed = Date.parse(session.completedAt ?? session.triggeredAt)
    if (Number.isNaN(parsed)) continue
    days.add(dayIndex(new Date(parsed)))
  }
  return days
}

export function computeStreak(
  sessions: readonly Session[],
  now: Date = nowDate()
): Streak {
  const days = doneDayIndexes(sessions)
  if (days.size === 0) return { current: 0, max: 0 }

  const today = dayIndex(now)
  let anchor: number | null = null
  if (days.has(today)) anchor = today
  else if (days.has(today - 1)) anchor = today - 1

  let current = 0
  if (anchor !== null) {
    let cursor = anchor
    while (days.has(cursor)) {
      current += 1
      cursor -= 1
    }
  }

  const sorted = Array.from(days).sort((a, b) => a - b)
  let max = 1
  let run = 1
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === sorted[index - 1] + 1) run += 1
    else run = 1
    max = Math.max(max, run)
  }

  return { current, max }
}
