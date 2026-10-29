// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isValidSession, sanitizeSessions } from '@shared/validation/session'
import type { Session } from '@shared/types/session'
import { makeSession } from '../fixtures'

function session(overrides: Partial<Session> = {}): unknown {
  return {
    id: 'session-1',
    exerciseId: 'neck-tilts',
    status: 'done',
    durationSec: 30,
    triggeredAt: '2026-10-30T09:00:00.000Z',
    ...overrides
  }
}

describe('isValidSession', () => {
  it('accepts the minimal stored shape and a fully populated one', () => {
    expect(isValidSession(session())).toBe(true)
    expect(
      isValidSession(
        session({
          completedAt: '2026-10-30T09:01:00.000Z',
          reps: 12,
          feeling: 4,
          weightKg: 72.6,
          photoIds: ['photo-1'],
          skipReason: 'busy'
        })
      )
    ).toBe(true)
  })

  it('rejects missing identity, status or a bad duration', () => {
    expect(isValidSession(null)).toBe(false)
    expect(isValidSession({})).toBe(false)
    expect(isValidSession(session({ id: '' }))).toBe(false)
    expect(isValidSession(session({ exerciseId: '' }))).toBe(false)
    expect(isValidSession(session({ status: 'unknown' as Session['status'] }))).toBe(false)
    expect(isValidSession(session({ durationSec: -1 }))).toBe(false)
    expect(isValidSession(session({ durationSec: Number.NaN }))).toBe(false)
  })

  it('rejects a malformed timestamp', () => {
    expect(isValidSession(session({ triggeredAt: 'yesterday' }))).toBe(false)
    expect(isValidSession(session({ completedAt: 'later' }))).toBe(false)
  })

  it('rejects optional details outside their documented ranges', () => {
    expect(isValidSession(session({ reps: 0 }))).toBe(false)
    expect(isValidSession(session({ reps: 1000 }))).toBe(false)
    expect(isValidSession(session({ reps: 2.5 }))).toBe(false)
    expect(isValidSession(session({ feeling: 0 as Session['feeling'] }))).toBe(false)
    expect(isValidSession(session({ feeling: 6 as Session['feeling'] }))).toBe(false)
    expect(isValidSession(session({ weightKg: 10 }))).toBe(false)
    expect(isValidSession(session({ weightKg: 500 }))).toBe(false)
    expect(isValidSession(session({ photoIds: 'photo-1' as unknown as string[] }))).toBe(false)
    expect(isValidSession(session({ photoIds: [1] as unknown as string[] }))).toBe(false)
  })

  it('allows a done session with a photo id and a skipped one with a reason', () => {
    expect(
      isValidSession({
        ...makeSession({ exerciseId: 'plank', status: 'skipped' }),
        skipReason: 'busy'
      })
    ).toBe(true)
  })
})

describe('sanitizeSessions', () => {
  it('keeps valid entries and drops malformed ones', () => {
    const result = sanitizeSessions([session(), { id: 'broken' }, session({ id: 'session-2' })])

    expect(result.map((entry) => entry.id)).toEqual(['session-1', 'session-2'])
  })

  it('returns an empty list for a non-array payload', () => {
    expect(sanitizeSessions(null)).toEqual([])
    expect(sanitizeSessions({})).toEqual([])
  })
})
