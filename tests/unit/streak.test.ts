// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeStreak } from '@shared/domain/streak'
import type { Session } from '@shared/types/session'
import { makeSession } from '../fixtures'

const NOW = new Date(2026, 9, 30, 12, 0, 0)

function at(daysBack: number, hour = 10): string {
  return new Date(2026, 9, 30 - daysBack, hour).toISOString()
}

function done(daysBack: number, id?: string): Session {
  return makeSession({
    id,
    exerciseId: 'neck-tilts',
    status: 'done',
    triggeredAt: at(daysBack),
    completedAt: at(daysBack)
  })
}

function skipped(daysBack: number): Session {
  return makeSession({
    exerciseId: 'neck-tilts',
    status: 'skipped',
    triggeredAt: at(daysBack),
    completedAt: at(daysBack)
  })
}

describe('computeStreak', () => {
  it('is zero without done sessions', () => {
    expect(computeStreak([], NOW)).toEqual({ current: 0, max: 0 })
    expect(computeStreak([skipped(0)], NOW)).toEqual({ current: 0, max: 0 })
  })

  it('counts consecutive days ending today', () => {
    expect(computeStreak([done(0), done(1), done(2)], NOW)).toEqual({ current: 3, max: 3 })
  })

  it('does not advance twice for two sessions on the same day', () => {
    expect(computeStreak([done(0, 'a'), done(0, 'b'), done(1)], NOW)).toEqual({
      current: 2,
      max: 2
    })
  })

  it('keeps yesterday as current until today ends', () => {
    expect(computeStreak([done(1), done(2)], NOW)).toEqual({ current: 2, max: 2 })
  })

  it('resets current after a missed day but keeps the max run', () => {
    const sessions = [done(2), done(3), done(4), done(5), done(10)]
    expect(computeStreak(sessions, NOW)).toEqual({ current: 0, max: 4 })
  })

  it('reports the longest run across the whole history', () => {
    const sessions = [done(0), done(1), done(2), done(5), done(6), done(7), done(8)]
    expect(computeStreak(sessions, NOW)).toEqual({ current: 3, max: 4 })
  })

  it('ignores malformed timestamps', () => {
    const broken = makeSession({
      exerciseId: 'neck-tilts',
      status: 'done',
      triggeredAt: 'not-a-date',
      completedAt: undefined
    })
    expect(computeStreak([broken, done(0)], NOW)).toEqual({ current: 1, max: 1 })
  })
})
