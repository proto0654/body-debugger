// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeCharacterCondition } from '@shared/domain/character-condition'
import type { SessionStatus } from '@shared/types/session'
import { makeSession } from '../fixtures'

function history(statuses: SessionStatus[]) {
  return statuses.map((status, index) => makeSession({
    exerciseId: 'neck-tilts', status,
    completedAt: new Date(Date.UTC(2026, 9, 30, 9, index)).toISOString()
  }))
}

describe('character condition', () => {
  it.each([[0, 0], [2, 0], [3, 1], [5, 1], [6, 2], [9, 2], [10, 3]] as const)(
    'maps %i skips to condition level %i', (count, level) => {
      expect(computeCharacterCondition(history(Array(count).fill('skipped')))).toEqual({
        points: count, level, recoverySessions: Math.ceil(count / 2)
      })
    }
  )

  it('counts missed reminders and popup closes as skips, but ignores snoozes', () => {
    const sessions = history(['skipped', 'snoozed', 'missed', 'skipped'])
    sessions[0].skipReason = 'popup-closed'
    expect(computeCharacterCondition(sessions)).toMatchObject({ points: 3, level: 1 })
  })

  it('recovers two points per completion without banking future credit', () => {
    expect(computeCharacterCondition(history(['done', 'done', 'skipped']))).toMatchObject({ points: 1 })
    expect(computeCharacterCondition(history(['skipped', 'skipped', 'skipped', 'done']))).toMatchObject({
      points: 1, level: 0, recoverySessions: 1
    })
    expect(computeCharacterCondition(history(['skipped', 'done']))).toMatchObject({ points: 0 })
  })

  it('caps neglect so five completions always fully restore the character', () => {
    const skips = Array<SessionStatus>(100).fill('missed')
    expect(computeCharacterCondition(history(skips))).toEqual({ points: 10, level: 3, recoverySessions: 5 })
    expect(computeCharacterCondition(history([...skips, ...Array<SessionStatus>(5).fill('done')]))).toEqual({
      points: 0, level: 0, recoverySessions: 0
    })
  })

  it('uses chronological results without mutating history or counting replays twice', () => {
    const sessions = history(['skipped', 'missed', 'skipped', 'done'])
    const shuffled = [sessions[3], sessions[1], sessions[0], sessions[2], sessions[0]]
    const before = structuredClone(shuffled)
    expect(computeCharacterCondition(shuffled)).toMatchObject({ points: 1, level: 0 })
    expect(shuffled).toEqual(before)
  })

  it('ignores malformed timestamps and falls back to the trigger time for older records', () => {
    const sessions = history(['skipped', 'missed', 'skipped'])
    sessions[0].completedAt = 'invalid'
    delete sessions[1].completedAt
    expect(computeCharacterCondition(sessions)).toMatchObject({ points: 2, level: 0 })
  })
})
