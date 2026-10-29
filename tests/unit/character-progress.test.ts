// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeCharacterProgress } from '@shared/domain/character-progress'
import type { Exercise } from '@shared/types/exercise'
import type { Session } from '@shared/types/session'
import { daysAgo, makeExercise, makeSession } from '../fixtures'

const catalog: Exercise[] = [
  makeExercise({ id: 'neck', category: 'neck' }),
  makeExercise({ id: 'shoulders', category: 'shoulders' }),
  makeExercise({ id: 'back', category: 'upperBack' }),
  makeExercise({ id: 'lower-back', category: 'lowerBack' }),
  makeExercise({ id: 'strength', category: 'chest', focus: ['strength'] }),
  makeExercise({ id: 'striking', category: 'fullBody', focus: ['striking'] }),
  makeExercise({ id: 'mobility', category: 'hips', focus: ['mobility'] }),
  makeExercise({ id: 'balance', category: 'ankles', focus: ['balance'] }),
  makeExercise({ id: 'untagged', category: 'wrists', focus: undefined })
]

function doneSessions(ids: string[]): Session[] {
  return ids.map((exerciseId, index) =>
    makeSession({
      exerciseId,
      triggeredAt: daysAgo(ids.length - index),
      completedAt: daysAgo(ids.length - index)
    })
  )
}

function stageAt(doneCount: number) {
  return computeCharacterProgress(doneSessions(Array(doneCount).fill('neck')), catalog).stage
}

describe('computeCharacterProgress — stage', () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [7, 1],
    [8, 2],
    [19, 2],
    [20, 3],
    [44, 3],
    [45, 4],
    [79, 4],
    [80, 5],
    [500, 5]
  ])('maps %i done sessions to stage %i', (doneCount, expected) => {
    expect(stageAt(doneCount)).toBe(expected)
  })

  it('ignores skipped, snoozed and missed sessions', () => {
    const sessions: Session[] = [
      ...['skipped', 'snoozed', 'missed'].map((status, index) =>
        makeSession({
          exerciseId: 'neck',
          status: status as Session['status'],
          triggeredAt: daysAgo(index + 1)
        })
      ),
      ...doneSessions(['neck', 'neck', 'neck'])
    ]
    expect(computeCharacterProgress(sessions, catalog).stage).toBe(1)
  })
})

describe('computeCharacterProgress — branch', () => {
  it('stays neutral with fewer than three scoring sessions', () => {
    expect(computeCharacterProgress(doneSessions(['neck', 'neck']), catalog).branch).toBe(
      'neutral'
    )
  })

  it('stays neutral when the leader does not beat the runner-up by 20%', () => {
    expect(
      computeCharacterProgress(
        doneSessions(['neck', 'neck', 'neck', 'strength', 'strength', 'strength']),
        catalog
      ).branch
    ).toBe('neutral')
  })

  it('keeps the leader when it reaches the 20% margin exactly', () => {
    // 6 posture vs 5 power: 6 >= 5 * 1.2
    expect(
      computeCharacterProgress(
        doneSessions(['neck', 'neck', 'back', 'lower-back', 'shoulders', 'shoulders', 'strength', 'strength', 'strength', 'striking', 'striking']),
        catalog
      ).branch
    ).toBe('posture')
  })

  it('derives posture from the zone categories before focus tags', () => {
    const taggedNeck = makeExercise({
      id: 'tagged-neck',
      category: 'neck',
      focus: ['strength', 'mobility']
    })
    const sessions = doneSessions(['tagged-neck', 'tagged-neck', 'tagged-neck'])
    expect(computeCharacterProgress(sessions, [...catalog, taggedNeck]).branch).toBe('posture')
  })

  it('derives power from strength and striking tags', () => {
    expect(computeCharacterProgress(doneSessions(['strength', 'striking', 'strength']), catalog).branch).toBe(
      'power'
    )
  })

  it('derives mobility from mobility and balance tags', () => {
    expect(
      computeCharacterProgress(doneSessions(['mobility', 'balance', 'mobility']), catalog).branch
    ).toBe('mobility')
  })

  it('does not count exercises without a training direction', () => {
    expect(
      computeCharacterProgress(doneSessions(['untagged', 'untagged', 'untagged']), catalog).branch
    ).toBe('neutral')
  })

  it('only looks at the last 30 done sessions for the branch', () => {
    const sessions: Session[] = [
      ...doneSessions(Array(100).fill('mobility')).map((session) => ({
        ...session,
        triggeredAt: daysAgo(200),
        completedAt: daysAgo(200)
      })),
      ...doneSessions([
        ...Array(3).fill('neck'),
        ...Array(2).fill('strength'),
        ...Array(25).fill('untagged')
      ])
    ]
    const progress = computeCharacterProgress(sessions, catalog)
    expect(progress.branch).toBe('posture')
    expect(progress.stage).toBe(5)
  })

  it('ignores sessions whose exercise is missing from the catalog', () => {
    const sessions = [
      ...doneSessions(['neck', 'neck', 'neck']),
      makeSession({ exerciseId: 'deleted-exercise', triggeredAt: daysAgo(1) })
    ]
    expect(computeCharacterProgress(sessions, catalog).branch).toBe('posture')
  })
})
