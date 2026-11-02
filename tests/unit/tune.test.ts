// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  applyScaleChange,
  buildTuneAggregates,
  cooldownExerciseIds,
  exerciseHints
} from '@shared/domain/tune'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import { resolveCatalog } from '@shared/domain/catalog'
import { normalizeProfileShifts } from '@shared/domain/focus-v2'
import { makeExercise, makeSession, makeSettings, daysAgo } from '../fixtures'

describe('exerciseHints', () => {
  const catalog = resolveCatalog(
    [upgradeExercise(makeExercise({ id: 'a', category: 'neck' }))],
    []
  )

  it('marks ready_to_progress after five done shows', () => {
    const sessions = Array.from({ length: 5 }, (_, index) =>
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(5 - index) })
    )
    const hints = exerciseHints(sessions, catalog)
    expect(hints).toEqual([
      expect.objectContaining({ exerciseId: 'a', kind: 'ready_to_progress', suggestedScale: 1.1 })
    ])
  })

  it('marks often_skipped after three skips in five shows and ignores snoozed', () => {
    const sessions = [
      makeSession({ exerciseId: 'a', status: 'skipped', triggeredAt: daysAgo(5) }),
      makeSession({ exerciseId: 'a', status: 'missed', triggeredAt: daysAgo(4) }),
      makeSession({ exerciseId: 'a', status: 'skipped', triggeredAt: daysAgo(3) }),
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(2) }),
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(1) }),
      makeSession({ exerciseId: 'a', status: 'snoozed', triggeredAt: daysAgo(0) })
    ]
    const hints = exerciseHints(sessions, catalog)
    expect(hints[0]?.kind).toBe('often_skipped')
  })

  it('respects cooldown ids', () => {
    const sessions = Array.from({ length: 5 }, (_, index) =>
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(5 - index) })
    )
    expect(exerciseHints(sessions, catalog, {}, new Set(['a']))).toEqual([])
  })

  it('derives cooldown from scaledAt until five new shows', () => {
    const scaledAt = daysAgo(3)
    const sessions = [
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(2), completedAt: daysAgo(2) }),
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(1), completedAt: daysAgo(1) })
    ]
    const cooling = cooldownExerciseIds(sessions, { a: { scale: 1.1, scaledAt } })
    expect(cooling.has('a')).toBe(true)

    const afterFive = [
      ...sessions,
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(0.5), completedAt: daysAgo(0.5) }),
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(0.2), completedAt: daysAgo(0.2) }),
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(0.1), completedAt: daysAgo(0.1) })
    ]
    expect(cooldownExerciseIds(afterFive, { a: { scale: 1.1, scaledAt } }).has('a')).toBe(false)
  })
})

describe('applyScaleChange / buildTuneAggregates', () => {
  const catalog = resolveCatalog(
    [upgradeExercise(makeExercise({ id: 'a', category: 'neck' }))],
    []
  )

  it('records previousScale and history entry', () => {
    const applied = applyScaleChange({}, [], 'a', 1.1, 'suggest', daysAgo(0))
    expect(applied.overrides.a?.scale).toBe(1.1)
    expect(applied.overrides.a?.previousScale).toBe(1)
    expect(applied.scaleHistory[0]).toMatchObject({
      exerciseId: 'a',
      fromScale: 1,
      toScale: 1.1,
      source: 'suggest'
    })
  })

  it('builds tune aggregates without raw session dates', () => {
    const sessions = [
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(1) }),
      makeSession({ exerciseId: 'a', status: 'skipped', triggeredAt: daysAgo(2) })
    ]
    const settings = makeSettings({ overrides: { a: { scale: 1.1 } } })
    const aggregates = buildTuneAggregates(sessions, catalog, settings, [])
    expect(aggregates.intervalMinutes).toBe(45)
    expect(aggregates.topSkipped[0]?.id).toBe('a')
    expect(JSON.stringify(aggregates)).not.toMatch(/triggeredAt/)
  })
})

describe('normalizeProfileShifts', () => {
  it('drops expired shifts and keeps future ones', () => {
    const now = Date.UTC(2026, 10, 2)
    const kept = normalizeProfileShifts(
      [
        {
          axis: 'zone',
          key: 'upper',
          level: 2,
          until: new Date(now + 3 * 86_400_000).toISOString(),
          changesetId: 'c1'
        },
        {
          axis: 'method',
          key: 'strength',
          level: 1,
          until: new Date(now - 86_400_000).toISOString(),
          changesetId: 'c2'
        }
      ],
      now
    )
    expect(kept).toHaveLength(1)
    expect(kept[0]?.key).toBe('upper')
  })
})
