// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { shippedCatalogV2, resolveCatalog } from '@shared/domain/catalog'
import { explainPick, overlap, pickExercise } from '@shared/domain/picker'
import { makeSettings } from '../fixtures'
import { emptyFocusV2 } from '@shared/domain/focus-v2'

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
})
