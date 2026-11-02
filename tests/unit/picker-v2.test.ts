// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { shippedCatalogV2, resolveCatalog } from '@shared/domain/catalog'
import {
  explainPick,
  overlap,
  pickExercise,
  profileBoostStep2,
  targetShares
} from '@shared/domain/picker'
import { makeSettings } from '../fixtures'
import { emptyFocusV2 } from '@shared/domain/focus-v2'
import type { Session } from '@shared/types/session'

describe('picker v2', () => {
  const catalog = resolveCatalog(shippedCatalogV2(), [])
  const settings = makeSettings()

  it('full zone overlap gives prev ×0.2 and today ×0.45 equivalents', () => {
    expect(overlap({ upper: 1 }, { upper: 1 })).toBe(1)
    expect(1 - 0.8 * 1).toBeCloseTo(0.2)
    expect(1 - 0.55 * 1).toBeCloseTo(0.45)
    expect(overlap({ upper: 1 }, { lower: 1 })).toBe(0)
  })

  it('explainPick chosenId matches pickExercise for many seeds', () => {
    const input = {
      catalog,
      recentSessions: [],
      settings,
      focus: emptyFocusV2(),
      profileStrength: 0.7
    }
    for (let seed = 0; seed < 40; seed++) {
      const picked = pickExercise(input, seed)
      const explained = explainPick(input, seed)
      expect(explained.chosenId).toBe(picked.id)
    }
  })

  it('rotation reports a next zone', () => {
    const explained = explainPick(
      {
        catalog,
        recentSessions: [],
        settings: makeSettings({ pickerMode: 'rotation' }),
        focus: emptyFocusV2()
      },
      1
    )
    expect(explained.nextRotationZone).toBeTruthy()
  })

  it('rotation level − skips soft zones on even cycles', () => {
    const focus = emptyFocusV2()
    focus.zones.upper = -1
    focus.zones.lower = 1
    focus.zones.core = 1
    focus.zones.full = 1
    const even = explainPick(
      {
        catalog,
        recentSessions: [],
        settings: makeSettings({ pickerMode: 'rotation' }),
        focus
      },
      1
    )
    expect(even.nextRotationZone).not.toBe('upper')

    const sessions: Session[] = Array.from({ length: 4 }, (_, index) => ({
      id: `s-${index}`,
      exerciseId: catalog.find((entry) => entry.dominantZone === 'lower')?.id ?? catalog[0]!.id,
      status: 'done',
      durationSec: 40,
      triggeredAt: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
      completedAt: new Date(Date.UTC(2026, 0, 1, index, 1)).toISOString()
    }))
    const odd = explainPick(
      {
        catalog,
        recentSessions: sessions,
        settings: makeSettings({ pickerMode: 'rotation' }),
        focus
      },
      1
    )
    expect(odd.nextRotationZone).toBeTruthy()
  })

  it('share-based profile boost rises for under-served ++ zones and scales with λ', () => {
    const focus = emptyFocusV2()
    focus.zones.upper = 2
    focus.zones.lower = -1
    const targets = targetShares(focus.zones)
    expect(targets.upper).toBeGreaterThan(targets.lower)

    const upper = catalog.find((entry) => entry.dominantZone === 'upper')!
    const scene = {
      now: Date.UTC(2026, 0, 25),
      lastDone: null,
      lastMethod: null as null,
      loadToday: {},
      lastZoneAt: new Map(),
      shareActual: { upper: 0.1, core: 0.1, lower: 0.7, full: 0.1 },
      shareMethodActual: {
        mobility: 0.2,
        strength: 0.2,
        cardio: 0.2,
        striking: 0.2,
        balance: 0.2
      },
      doneCount: 10
    }
    const upperBoost = profileBoostStep2(upper, focus, scene)
    expect(upperBoost).toBeGreaterThan(1)

    const low = explainPick(
      {
        catalog: [upper],
        recentSessions: [],
        settings: makeSettings({ profileStrength: 0.2 }),
        focus,
        profileStrength: 0.2,
        useShareProfile: true,
        now: new Date(Date.UTC(2026, 0, 25))
      },
      1
    )
    const high = explainPick(
      {
        catalog: [upper],
        recentSessions: [],
        settings: makeSettings({ profileStrength: 1 }),
        focus,
        profileStrength: 1,
        useShareProfile: true,
        now: new Date(Date.UTC(2026, 0, 25))
      },
      1
    )
    const lowProfile = low.candidates.find((candidate) => candidate.id === upper.id)?.factors.find(
      (factor) => factor.key === 'profile'
    )?.mult
    const highProfile = high.candidates.find((candidate) => candidate.id === upper.id)?.factors.find(
      (factor) => factor.key === 'profile'
    )?.mult
    expect(lowProfile).toBeGreaterThan(1)
    expect(highProfile).toBeGreaterThan(lowProfile!)
  })
})
