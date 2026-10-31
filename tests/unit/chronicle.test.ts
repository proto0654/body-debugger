// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildChronicle,
  chronicleDateIndex,
  chronicleExplanation,
  chroniclePrefix,
  chronicleSummary
} from '@shared/domain/chronicle'
import { computeCharacterCondition } from '@shared/domain/character-condition'
import { computeCharacterProgress } from '@shared/domain/character-progress'
import { computeStreak } from '@shared/domain/streak'
import { makeSession } from '../fixtures'

function at(day: number, hour = 12): string {
  return new Date(2026, 9, day, hour, 0, 0).toISOString()
}

const NOW = new Date(2026, 9, 31, 12, 0, 0)

describe('dashboard chronicle', () => {
  it('returns an empty timeline for an empty history', () => {
    const chronicle = buildChronicle([], { now: NOW })
    expect(chronicle).toMatchObject({ sessions: [], entries: [], milestoneIndexes: [], firstAt: null })
    expect(chronicleSummary(chronicle, 0)).toBeNull()
    expect(chroniclePrefix(chronicle, 0)).toEqual([])
  })

  it('builds a start entry, one entry per session and a now entry', () => {
    const sessions = [
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(28) }),
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(29) }),
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(30) })
    ]
    const chronicle = buildChronicle(sessions, { now: NOW })
    expect(chronicle.entries.map(entry => entry.kind)).toEqual(['start', 'session', 'session', 'session', 'now'])
    expect(chronicle.entries.map(entry => entry.sessionCount)).toEqual([0, 1, 2, 3, 3])
    expect(chronicle.entries[0]!.at).toBe(new Date(Date.parse(at(28)) - 1).toISOString())
    expect(chronicle.entries[2]!.label).toContain('Выполнено')
    expect(chronicle.entries.at(-1)!.at).toBe(NOW.toISOString())
    expect(chronicle.firstAt).toBe(at(28))
  })

  it('sorts, drops invalid timestamps and de-duplicates session ids', () => {
    const duplicate = makeSession({ id: 'same', exerciseId: 'neck-tilts', completedAt: at(29) })
    const sessions = [
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(30) }),
      { ...makeSession({ exerciseId: 'neck-tilts' }), completedAt: 'not-a-date', triggeredAt: 'not-a-date' },
      duplicate,
      { ...duplicate },
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(28) })
    ]
    const chronicle = buildChronicle(sessions, { now: NOW })
    expect(chronicle.sessions.map(session => session.id)).toHaveLength(3)
    expect(chronicle.sessions.map(session => Date.parse(session.completedAt!)))
      .toEqual([Date.parse(at(28)), Date.parse(at(29)), Date.parse(at(30))])
  })

  it('increments stage, branch and condition at the entries that cause the change', () => {
    const sessions = [28, 29, 30].map(day => makeSession({ exerciseId: 'neck-tilts', completedAt: at(day) }))
    const chronicle = buildChronicle(sessions, { now: NOW })
    expect(chronicle.entries[3]!.stage).toBe(1)
    expect(chronicle.entries[3]!.branch).toBe('posture')
    expect(chronicle.entries[3]!.milestone).toBe(true)
    expect(chronicle.milestoneIndexes).toContain(3)

    const missed = [28, 29, 30].map(day => makeSession({
      exerciseId: 'neck-tilts', status: 'missed', completedAt: at(day)
    }))
    const neglect = buildChronicle(missed, { now: NOW })
    expect(neglect.entries[3]!.conditionLevel).toBe(1)
    expect(neglect.milestoneIndexes).toContain(3)
  })

  it('marks a streak break and explains it', () => {
    const sessions = [
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(28) }),
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(29) })
    ]
    const chronicle = buildChronicle(sessions, { now: NOW })
    const lastSession = chronicle.entries.find(entry => entry.kind === 'now')!
    expect(lastSession.milestone).toBe(true)
    const nowIndex = chronicle.entries.length - 1
    expect(chronicleExplanation(chronicle, nowIndex)).toContain('Серия дней прервана')
    expect(chronicleSummary(chronicle, nowIndex)!.streak.current).toBe(0)
  })

  it('keeps the end summary consistent with the shared domain rules', () => {
    const sessions = [
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(28) }),
      makeSession({ exerciseId: 'neck-tilts', status: 'missed', completedAt: at(29) }),
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(30) })
    ]
    const chronicle = buildChronicle(sessions, { now: NOW })
    const end = chronicleSummary(chronicle, chronicle.entries.length - 1)!
    expect(end.character).toEqual(computeCharacterProgress(sessions))
    expect(end.condition).toEqual(computeCharacterCondition(sessions))
    expect(end.streak).toEqual(computeStreak(sessions, NOW))
    expect(end.journey.done).toBe(2)
    expect(chroniclePrefix(chronicle, chronicle.entries.length - 1)).toHaveLength(3)
  })

  it('seeks by local date and returns the last entry before the day ends', () => {
    const sessions = [
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(28) }),
      makeSession({ exerciseId: 'neck-tilts', completedAt: at(30) })
    ]
    const chronicle = buildChronicle(sessions, { now: NOW })
    expect(chronicleDateIndex(chronicle, '2026-10-28')).toBe(1)
    expect(chronicleDateIndex(chronicle, '2026-10-29')).toBe(1)
    expect(chronicleDateIndex(chronicle, '2026-10-31')).toBe(chronicle.entries.length - 1)
    expect(chronicleDateIndex(chronicle, '2026-10-27')).toBe(0)
    expect(chronicleDateIndex(chronicle, 'not-a-date')).toBeNull()
  })

  it('explains the initial state and a form milestone', () => {
    const sessions = [28, 29, 30].map(day => makeSession({ exerciseId: 'neck-tilts', completedAt: at(day) }))
    const chronicle = buildChronicle(sessions, { now: NOW })
    expect(chronicleExplanation(chronicle, 0)).toContain('Начальное состояние')
    expect(chronicleExplanation(chronicle, 3)).toContain('Новая форма')
  })
})
