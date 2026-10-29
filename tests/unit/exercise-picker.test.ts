// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { FALLBACK_EXERCISE } from '@shared/constants/exercises'
import { pickNextExercise, type PickerContext } from '@shared/domain/exercise-picker'
import type { Exercise } from '@shared/types/exercise'
import type { Session } from '@shared/types/session'
import type { AppSettings } from '@shared/types/settings'
import {
  NOW,
  daysAgo,
  makeExercise,
  makeSession,
  makeSettings,
  seededRandom
} from '../fixtures'

const neckA = makeExercise({ id: 'neck-a', category: 'neck' })
const neckB = makeExercise({ id: 'neck-b', category: 'neck' })
const neckC = makeExercise({ id: 'neck-c', category: 'neck' })
const hipsA = makeExercise({ id: 'hips-a', category: 'hips', group: 'lower' })
const hipsB = makeExercise({ id: 'hips-b', category: 'hips', group: 'lower' })
const forearms = makeExercise({ id: 'forearms', category: 'forearms' })

interface PickOptions {
  catalog?: Exercise[]
  sessions?: Session[]
  settings?: Partial<AppSettings>
  random?: () => number
  now?: Date
}

function pick({ catalog, sessions = [], settings = {}, random = () => 0, now }: PickOptions): Exercise {
  const context: PickerContext = {
    catalog: catalog ?? [neckA, hipsA],
    recentSessions: sessions,
    settings: makeSettings(settings),
    now: now ?? NOW,
    random
  }
  return pickNextExercise(context)
}

function sample(options: PickOptions, times: number, seed = 42): Exercise[] {
  const random = seededRandom(seed)
  return Array.from({ length: times }, () => pick({ ...options, random }))
}

function count(picks: Exercise[], predicate: (exercise: Exercise) => boolean): number {
  return picks.filter(predicate).length
}

describe('pickNextExercise — fallbacks and availability', () => {
  it('falls back when the catalog is empty', () => {
    expect(pick({ catalog: [] })).toBe(FALLBACK_EXERCISE)
  })

  it('falls back when equipment exercises are the only candidates and inventory is off', () => {
    const bag = makeExercise({ id: 'bag', equipment: ['bag-50'] })
    expect(pick({ catalog: [bag] })).toBe(FALLBACK_EXERCISE)
  })

  it('hides equipment exercises when the owned item is missing', () => {
    const bag = makeExercise({ id: 'bag', equipment: ['bag-50'] })
    const plain = makeExercise({ id: 'plain' })
    const picks = sample(
      {
        catalog: [bag, plain],
        settings: { inventory: { enabled: true, items: ['dumbbells'] } }
      },
      40
    )
    expect(count(picks, (exercise) => exercise.id === 'bag')).toBe(0)
  })

  it('opens equipment exercises with inventory on and the item owned', () => {
    const bag = makeExercise({ id: 'bag', equipment: ['bag-50'] })
    expect(
      pick({
        catalog: [bag],
        settings: { inventory: { enabled: true, items: ['bag-50'] } }
      }).id
    ).toBe('bag')
  })

  it('requires every listed item for multi-item equipment', () => {
    const combo = makeExercise({ id: 'combo', equipment: ['bag-50', 'band'] })
    expect(
      pick({
        catalog: [combo],
        settings: { inventory: { enabled: true, items: ['bag-50'] } }
      })
    ).toBe(FALLBACK_EXERCISE)
  })
})

describe('pickNextExercise — deterministic roll edges', () => {
  it('picks the first candidate at random 0', () => {
    expect(pick({ random: () => 0 }).id).toBe('neck-a')
  })

  it('picks the last candidate at random 1', () => {
    expect(pick({ random: () => 1 }).id).toBe('hips-a')
  })

  it('keeps working when a session references an unknown exercise', () => {
    const sessions = [makeSession({ exerciseId: 'deleted-exercise' })]
    expect(pick({ sessions }).id).toBe('neck-a')
  })

  it('ignores sessions with an invalid timestamp', () => {
    const broken = makeSession({
      exerciseId: 'hips-a',
      triggeredAt: 'not-a-date',
      completedAt: 'not-a-date'
    })
    const withBroken = sample({ sessions: [broken] }, 30, 7).map((exercise) => exercise.id)
    const baseline = sample({}, 30, 7).map((exercise) => exercise.id)
    expect(withBroken).toEqual(baseline)
  })

  it('falls back to balance tuning for an unknown picker mode', () => {
    expect(
      pick({ settings: { pickerMode: 'nonsense' as AppSettings['pickerMode'] } }).id
    ).toBe('neck-a')
  })
})

describe('pickNextExercise — penalties', () => {
  const sessions = [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(1) })]

  it('demotes the category of the previous done session', () => {
    const picks = sample({ sessions }, 400, 11)
    const neckPicks = count(picks, (exercise) => exercise.category === 'neck')
    expect(neckPicks).toBeLessThan(100)
    expect(neckPicks).toBeGreaterThan(0)
  })

  it('does not count skipped, snoozed or missed sessions as training', () => {
    const statuses: Session['status'][] = ['skipped', 'snoozed', 'missed']
    for (const status of statuses) {
      const idle = [makeSession({ exerciseId: 'neck-a', status, triggeredAt: daysAgo(1) })]
      const withIdle = sample({ sessions: idle }, 50, 3).map((exercise) => exercise.id)
      const baseline = sample({}, 50, 3).map((exercise) => exercise.id)
      expect(withIdle).toEqual(baseline)
    }
  })

  it('demotes a category already trained today', () => {
    const today = [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(0) })]
    const picks = sample({ sessions: today }, 400, 5)
    expect(count(picks, (exercise) => exercise.category === 'neck')).toBeLessThan(
      count(picks, (exercise) => exercise.category === 'hips')
    )
  })
})

describe('pickNextExercise — neglect', () => {
  it('caps the neglect bonus at a week', () => {
    const monthOld = sample(
      { sessions: [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(30) })] },
      60,
      9
    ).map((exercise) => exercise.id)
    const weekOld = sample(
      { sessions: [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(7) })] },
      60,
      9
    ).map((exercise) => exercise.id)
    expect(monthOld).toEqual(weekOld)
  })

  it('boosts a category that is 7 days stale more than one 3 days stale', () => {
    const stale = sample(
      { sessions: [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(7) })] },
      200,
      21
    )
    const recent = sample(
      { sessions: [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(3) })] },
      200,
      21
    )
    expect(count(stale, (exercise) => exercise.category === 'neck')).toBeGreaterThan(
      count(recent, (exercise) => exercise.category === 'neck')
    )
  })
})

describe('pickNextExercise — focus', () => {
  const strength = makeExercise({ id: 'strength', category: 'back', focus: ['strength'] })
  const plain = makeExercise({ id: 'plain', category: 'hips' })

  it('prioritises the primary direction', () => {
    const picks = sample(
      {
        catalog: [strength, plain],
        settings: { pickerMode: 'focus', focus: { primary: 'strength', accents: [] } }
      },
      200,
      13
    )
    expect(count(picks, (exercise) => exercise.id === 'strength')).toBeGreaterThan(
      count(picks, (exercise) => exercise.id === 'plain')
    )
  })

  it('boosts accent directions above untagged exercises', () => {
    const picks = sample(
      {
        catalog: [strength, plain],
        settings: { pickerMode: 'focus', focus: { primary: null, accents: ['strength'] } }
      },
      200,
      17
    )
    expect(count(picks, (exercise) => exercise.id === 'strength')).toBeGreaterThan(
      count(picks, (exercise) => exercise.id === 'plain')
    )
  })

  it('gives no bonus when the exercise has no focus tags', () => {
    const baseline = sample({ catalog: [plain, hipsB] }, 80, 23).map((exercise) => exercise.id)
    const focused = sample(
      {
        catalog: [plain, hipsB],
        settings: { focus: { primary: 'strength', accents: [] } }
      },
      80,
      23
    ).map((exercise) => exercise.id)
    expect(focused).toEqual(baseline)
  })
})

describe('pickNextExercise — modes', () => {
  const sessions = [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(1) })]
  const fourCategories = [neckA, neckB, neckC, hipsA, hipsB, forearms]

  it('balance may repeat the previous category', () => {
    expect(pick({ catalog: fourCategories, sessions }).id).toBe('neck-a')
  })

  it('rotation drops the previous category when enough alternatives exist', () => {
    const picks = sample(
      { catalog: fourCategories, sessions, settings: { pickerMode: 'rotation' } },
      100,
      29
    )
    expect(count(picks, (exercise) => exercise.category === 'neck')).toBe(0)
  })

  it('rotation keeps the previous category when fewer than three alternatives exist', () => {
    const picks = sample(
      { catalog: [neckA, neckB, neckC, hipsA, hipsB], sessions, settings: { pickerMode: 'rotation' } },
      100,
      31
    )
    expect(count(picks, (exercise) => exercise.category === 'neck')).toBeGreaterThan(0)
  })

  it('push drives the most neglected category', () => {
    const picks = sample(
      {
        catalog: [neckA, hipsA],
        sessions: [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(0) })],
        settings: { pickerMode: 'push' }
      },
      120,
      37
    )
    expect(count(picks, (exercise) => exercise.category === 'hips')).toBeGreaterThan(100)
  })
})
