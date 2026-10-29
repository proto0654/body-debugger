// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildHeatmap,
  localDateKey,
  summarizeStats
} from '@shared/domain/stats'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import type { Session } from '@shared/types/session'
import { makeSession } from '../fixtures'

const NOW = new Date(2026, 9, 30, 12, 0, 0)

function at(daysBack: number, hour = 10): string {
  return new Date(2026, 9, 30 - daysBack, hour, 0, 0).toISOString()
}

function done(
  exerciseId: string,
  daysBack: number,
  extra: Partial<Session> = {}
): Session {
  return makeSession({
    exerciseId,
    status: 'done',
    triggeredAt: at(daysBack),
    completedAt: at(daysBack),
    ...extra
  })
}

function result(
  exerciseId: string,
  status: Session['status'],
  daysBack: number
): Session {
  return makeSession({
    exerciseId,
    status,
    triggeredAt: at(daysBack),
    completedAt: at(daysBack)
  })
}

describe('buildHeatmap', () => {
  it('returns the requested number of local days, today last', () => {
    const heatmap = buildHeatmap([], { days: 7, now: NOW })

    expect(heatmap.days).toHaveLength(7)
    expect(heatmap.days[0].date).toBe('2026-10-24')
    expect(heatmap.days[6].date).toBe('2026-10-30')
    expect(heatmap.doneTotal).toBe(0)
    expect(heatmap.activeDays).toBe(0)
  })

  it('counts every status on its local day', () => {
    const heatmap = buildHeatmap(
      [
        done('neck-tilts', 0),
        done('neck-tilts', 0),
        result('neck-tilts', 'skipped', 0),
        result('neck-tilts', 'snoozed', 1),
        result('neck-tilts', 'missed', 2)
      ],
      { days: 7, now: NOW }
    )

    expect(heatmap.days[6]).toMatchObject({
      date: '2026-10-30',
      done: 2,
      skipped: 1,
      snoozed: 0,
      missed: 0,
      total: 3,
      level: 2
    })
    expect(heatmap.days[5]).toMatchObject({ date: '2026-10-29', snoozed: 1, level: 0 })
    expect(heatmap.days[4]).toMatchObject({ date: '2026-10-28', missed: 1, level: 0 })
    expect(heatmap.doneTotal).toBe(2)
    expect(heatmap.activeDays).toBe(1)
  })

  it('caps the intensity at three done sessions', () => {
    const sessions = [0, 1, 2, 3, 4].map((index) =>
      done('neck-tilts', 0, { id: `session-${index}` })
    )
    const heatmap = buildHeatmap(sessions, { days: 1, now: NOW })

    expect(heatmap.days[0]).toMatchObject({ done: 5, level: 3 })
  })

  it('pads Monday-first weeks on both edges', () => {
    const heatmap = buildHeatmap([], { days: 7, now: NOW })

    expect(heatmap.weeks).toHaveLength(2)
    for (const week of heatmap.weeks) expect(week).toHaveLength(7)

    // 2026-10-24 is a Saturday: five empty cells, then Sat + Sun.
    expect(heatmap.weeks[0].slice(0, 5)).toEqual([null, null, null, null, null])
    expect(heatmap.weeks[0][5]?.date).toBe('2026-10-24')
    expect(heatmap.weeks[0][6]?.date).toBe('2026-10-25')
    expect(heatmap.weeks[1][0]?.date).toBe('2026-10-26')
    expect(heatmap.weeks[1].slice(5)).toEqual([null, null])
  })

  it('defaults to a 13-week window', () => {
    const heatmap = buildHeatmap([], { now: NOW })
    expect(heatmap.days).toHaveLength(91)
  })

  it('ignores sessions with an unparsable timestamp', () => {
    const heatmap = buildHeatmap(
      [makeSession({ exerciseId: 'neck-tilts', triggeredAt: 'not-a-date', completedAt: undefined })],
      { days: 2, now: NOW }
    )
    expect(heatmap.doneTotal).toBe(0)
  })
})

describe('summarizeStats', () => {
  const sessions: Session[] = [
    done('neck-tilts', 0),
    done('neck-tilts', 0),
    done('bag-shrugs', 1),
    result('neck-tilts', 'skipped', 1),
    result('plank', 'snoozed', 2),
    result('plank', 'missed', 2),
    done('plank', 8)
  ]

  it('counts statuses and active days', () => {
    const summary = summarizeStats(sessions, { now: NOW })

    expect(summary.done).toBe(4)
    expect(summary.skipped).toBe(1)
    expect(summary.snoozed).toBe(1)
    expect(summary.missed).toBe(1)
    expect(summary.activeDays).toBe(3)
    expect(summary.weekDone).toBe(3)
    expect(summary.averagePerActiveDay).toBeCloseTo(4 / 3)
  })

  it('builds zone slices that add up to the done total', () => {
    const summary = summarizeStats(sessions, { now: NOW, catalog: EXERCISE_CATALOG })

    expect(summary.zones.find((zone) => zone.category === 'neck')?.count).toBe(2)
    const shareSum = summary.zones.reduce((sum, zone) => sum + zone.share, 0)
    expect(shareSum).toBeCloseTo(1)
  })

  it('counts exercise groups and titles from the catalog', () => {
    const summary = summarizeStats(sessions, { now: NOW, catalog: EXERCISE_CATALOG })

    // Two neck sessions plus bag shrugs (shoulders) are all upper-body.
    expect(summary.groups.find((group) => group.group === 'upper')?.count).toBe(3)
    expect(summary.topExercises[0]).toMatchObject({
      exerciseId: 'neck-tilts',
      title: 'Наклоны головы',
      count: 2
    })
  })

  it('falls back to the raw id for an exercise missing from the catalog', () => {
    const summary = summarizeStats([done('custom-ai-move', 0)], {
      now: NOW,
      catalog: EXERCISE_CATALOG
    })

    expect(summary.topExercises[0]).toMatchObject({
      exerciseId: 'custom-ai-move',
      title: 'custom-ai-move'
    })
  })

  it('returns zeroed slices when nothing was done', () => {
    const summary = summarizeStats([result('plank', 'skipped', 0)], { now: NOW })
    expect(summary.zones).toEqual([])
    expect(summary.groups).toEqual([])
    expect(summary.topExercises).toEqual([])
    expect(summary.averagePerActiveDay).toBe(0)
  })
})

describe('localDateKey', () => {
  it('uses the local calendar day, not UTC', () => {
    const lateNight = new Date(2026, 9, 30, 23, 30, 0)
    expect(localDateKey(lateNight)).toBe('2026-10-30')
  })
})
