import { describe, expect, it } from 'vitest'
import {
  WEIGHT_HISTORY_DAYS,
  latestWeightEntry,
  mergeSessionWeights,
  normalizeWeightEntry,
  normalizeWeightTarget,
  weightChangeKg,
  weightEntryFromSession,
  weightSeries,
  weightTargetGapKg
} from '@shared/domain/weight'
import { NOW, daysAgo, makeSession, makeWeightEntry } from '../fixtures'

describe('normalizeWeightEntry', () => {
  it('accepts numbers and numeric strings, trimmed to one decimal', () => {
    expect(normalizeWeightEntry({ weightKg: 72.55, at: daysAgo(0) })).toEqual({
      at: daysAgo(0),
      weightKg: 72.6
    })
    expect(normalizeWeightEntry({ weightKg: ' 81.44 ', at: daysAgo(0) })).toEqual({
      at: daysAgo(0),
      weightKg: 81.4
    })
  })

  it('defaults a missing timestamp to now', () => {
    expect(normalizeWeightEntry({ weightKg: 70 }, NOW)?.at).toBe(NOW.toISOString())
  })

  it('drops weights outside the documented range', () => {
    expect(normalizeWeightEntry({ weightKg: 19.9 })).toBeNull()
    expect(normalizeWeightEntry({ weightKg: 300.1 })).toBeNull()
    expect(normalizeWeightEntry({ weightKg: 'тяжёлый' })).toBeNull()
    expect(normalizeWeightEntry({ weightKg: Number.NaN })).toBeNull()
  })

  it('rejects a malformed timestamp instead of silently using now', () => {
    expect(normalizeWeightEntry({ weightKg: 72, at: 'вчера' })).toBeNull()
    expect(normalizeWeightEntry({ weightKg: 72, at: 123 })).toBeNull()
  })

  it('keeps a meaningful session id only', () => {
    expect(normalizeWeightEntry({ weightKg: 72, sessionId: ' session-1 ' })).toEqual({
      at: expect.any(String),
      weightKg: 72,
      sessionId: 'session-1'
    })
    expect(normalizeWeightEntry({ weightKg: 72, sessionId: '   ' })).not.toHaveProperty('sessionId')
    expect(normalizeWeightEntry({ weightKg: 72, sessionId: 42 })).not.toHaveProperty('sessionId')
  })
})

describe('normalizeWeightTarget', () => {
  it('rounds a valid goal and rejects an invalid one', () => {
    expect(normalizeWeightTarget('70.04')).toBe(70)
    expect(normalizeWeightTarget(0)).toBeNull()
    expect(normalizeWeightTarget(500)).toBeNull()
    expect(normalizeWeightTarget(null)).toBeNull()
  })
})

describe('weightEntryFromSession', () => {
  it('turns a completed session with a weight into a deterministic entry', () => {
    const session = makeSession({
      exerciseId: 'neck-circles',
      completedAt: daysAgo(2),
      weightKg: 73.44
    })

    expect(weightEntryFromSession(session)).toEqual({
      id: `weight:session:${session.id}`,
      at: daysAgo(2),
      weightKg: 73.4,
      sessionId: session.id
    })
  })

  it('ignores sessions without a usable weight or without a done status', () => {
    expect(weightEntryFromSession(makeSession({ exerciseId: 'hips' }))).toBeNull()
    expect(
      weightEntryFromSession(makeSession({ exerciseId: 'hips', status: 'skipped', weightKg: 70 }))
    ).toBeNull()
    expect(
      weightEntryFromSession(makeSession({ exerciseId: 'hips', weightKg: 500 }))
    ).toBeNull()
  })
})

describe('mergeSessionWeights', () => {
  const sessions = [
    makeSession({ exerciseId: 'neck-circles', completedAt: daysAgo(5), weightKg: 75 }),
    makeSession({ exerciseId: 'hips', completedAt: daysAgo(3), weightKg: 74.2 }),
    makeSession({ exerciseId: 'hips', completedAt: daysAgo(1) })
  ]

  it('backfills sessions measured before the weight layer existed', () => {
    const merged = mergeSessionWeights(sessions, [])
    expect(merged.map((entry) => entry.weightKg)).toEqual([75, 74.2])
  })

  it('is idempotent and keeps manual entries untouched', () => {
    const manual = makeWeightEntry({ weightKg: 76, at: daysAgo(6) })
    const once = mergeSessionWeights(sessions, [manual])
    const twice = mergeSessionWeights(sessions, once)

    expect(once).toHaveLength(3)
    expect(twice).toHaveLength(3)
    expect(twice[0]).toEqual(manual)
  })

  it('does not mutate the input array', () => {
    const current = [makeWeightEntry({ weightKg: 76 })]
    mergeSessionWeights(sessions, current)
    expect(current).toHaveLength(1)
  })
})

describe('weightSeries', () => {
  it('keeps only the window and sorts oldest first', () => {
    const entries = [
      makeWeightEntry({ weightKg: 80, at: daysAgo(WEIGHT_HISTORY_DAYS + 1) }),
      makeWeightEntry({ weightKg: 78, at: daysAgo(10) }),
      makeWeightEntry({ weightKg: 79, at: daysAgo(20) }),
      makeWeightEntry({ weightKg: 77, at: daysAgo(1) })
    ]

    expect(weightSeries(entries, { now: NOW }).map((point) => point.weightKg)).toEqual([79, 78, 77])
  })

  it('skips entries with a malformed timestamp', () => {
    const entries = [
      makeWeightEntry({ weightKg: 80, at: 'not-a-date' }),
      makeWeightEntry({ weightKg: 78, at: daysAgo(2) })
    ]
    expect(weightSeries(entries, { now: NOW })).toEqual([
      { at: Date.parse(daysAgo(2)), weightKg: 78 }
    ])
  })
})

describe('weight summaries', () => {
  const series = weightSeries(
    [
      makeWeightEntry({ weightKg: 80, at: daysAgo(20) }),
      makeWeightEntry({ weightKg: 78.4, at: daysAgo(1) })
    ],
    { now: NOW }
  )

  it('measures the change across the series', () => {
    expect(weightChangeKg(series)).toBe(-1.6)
    expect(weightChangeKg(series.slice(0, 1))).toBeNull()
  })

  it('reports the distance to the goal with a sign', () => {
    expect(weightTargetGapKg(78.4, 75)).toBe(3.4)
    expect(weightTargetGapKg(78.4, 80)).toBe(-1.6)
    expect(weightTargetGapKg(78.4, 78.4)).toBe(0)
  })

  it('finds the latest entry outside the chart window', () => {
    const old = makeWeightEntry({ weightKg: 80, at: daysAgo(400) })
    const recent = makeWeightEntry({ weightKg: 77, at: daysAgo(2) })
    expect(latestWeightEntry([old, recent])).toEqual(recent)
    expect(latestWeightEntry([])).toBeNull()
  })
})
