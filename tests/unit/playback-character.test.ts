import { describe, expect, it } from 'vitest'
import { playbackCharacterAt } from '@shared/domain/character-context'
import { makeSession } from '../fixtures'

describe('playbackCharacterAt', () => {
  it('derives stage from the session prefix and emotion from the planned outcome', () => {
    const sessions = [
      makeSession({ exerciseId: 'neck-tilts', status: 'done', completedAt: '2026-10-28T12:00:00.000Z' }),
      makeSession({ exerciseId: 'neck-tilts', status: 'done', completedAt: '2026-10-29T12:00:00.000Z' })
    ]
    const next = makeSession({ exerciseId: 'neck-tilts', status: 'skipped', completedAt: '2026-10-30T12:00:00.000Z' })
    const overlay = playbackCharacterAt(
      [...sessions, next],
      new Date('2026-10-30T12:00:00.000Z'),
      'desk-hulk',
      'average',
      next
    )
    expect(overlay.packId).toBe('desk-hulk')
    expect(overlay.build).toBe('average')
    expect(overlay.stage).toBeGreaterThanOrEqual(0)
    expect(overlay.emotion).toBe('neutral')
  })
})
