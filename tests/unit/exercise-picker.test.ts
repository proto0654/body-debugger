// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { FALLBACK_EXERCISE } from '@shared/constants/exercises'
import { resolveCatalog } from '@shared/domain/catalog'
import { pickNextExercise, type PickerContext } from '@shared/domain/exercise-picker'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import { explainPick } from '@shared/domain/picker'
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
const hipsA = makeExercise({ id: 'hips-a', category: 'hips', group: 'lower' })
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

describe('pickNextExercise — Catalog V2 adapter', () => {
  it('is deterministic for a fixed RNG sequence', () => {
    const a = sample({ catalog: [neckA, hipsA, forearms] }, 20, 7).map((e) => e.id)
    const b = sample({ catalog: [neckA, hipsA, forearms] }, 20, 7).map((e) => e.id)
    expect(a).toEqual(b)
  })

  it('applies Focus V2 method levels in explainPick profile factor', () => {
    const strength = makeExercise({
      id: 'strength',
      category: 'chest',
      group: 'upper',
      focus: ['strength']
    })
    const plainUpper = makeExercise({
      id: 'plain-upper',
      category: 'neck',
      group: 'upper',
      focus: ['mobility']
    })
    const catalog = resolveCatalog(
      [strength, plainUpper].map((exercise) => upgradeExercise(exercise)),
      []
    )
    const explained = explainPick(
      {
        catalog,
        recentSessions: [],
        settings: makeSettings({
          pickerMode: 'focus',
          profileStrength: 1,
          focusV2: {
            zones: { upper: 0, core: 0, lower: 0, full: 0 },
            methods: { mobility: -1, strength: 2, cardio: -1, striking: -1, balance: -1 }
          }
        }),
        focus: {
          zones: { upper: 0, core: 0, lower: 0, full: 0 },
          methods: { mobility: -1, strength: 2, cardio: -1, striking: -1, balance: -1 }
        },
        profileStrength: 1,
        useShareProfile: false
      },
      1
    )
    const strengthWeight = explained.candidates.find((c) => c.id === 'strength')?.weight ?? 0
    const plainWeight = explained.candidates.find((c) => c.id === 'plain-upper')?.weight ?? 0
    expect(strengthWeight).toBeGreaterThan(plainWeight)
  })

  it('rotation cycles zones away from the last done dominant zone', () => {
    const sessions = [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(1) })]
    const picks = sample(
      {
        catalog: [neckA, hipsA, forearms],
        sessions,
        settings: { pickerMode: 'rotation' }
      },
      80,
      29
    )
    // After upper (neck), cycle goes to lower — necks should be rare/absent.
    expect(count(picks, (exercise) => exercise.category === 'neck')).toBeLessThan(40)
  })

  it('push drives the most neglected zone', () => {
    const picks = sample(
      {
        catalog: [neckA, hipsA],
        sessions: [makeSession({ exerciseId: 'neck-a', triggeredAt: daysAgo(0) })],
        settings: { pickerMode: 'push' }
      },
      120,
      37
    )
    expect(count(picks, (exercise) => exercise.category === 'hips')).toBeGreaterThan(60)
  })
})
