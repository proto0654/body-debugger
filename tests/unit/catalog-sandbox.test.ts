import { describe, expect, it } from 'vitest'
import {
  comboMatrix,
  effectiveSize,
  poolSnapshot,
  previewDelta,
  simulate,
  simulateWeek
} from '../../shared/domain/catalog-sandbox'
import { shippedCatalogV2, resolveCatalog } from '../../shared/domain/catalog'
import { emptyFocusV2 } from '../../shared/domain/focus-v2'
import { makeSettings } from '../fixtures'

function baseInput() {
  const catalog = resolveCatalog(shippedCatalogV2(), [], {})
  return {
    catalog,
    recentSessions: [],
    settings: makeSettings({ intervalMinutes: 45 }),
    focus: emptyFocusV2(),
    profileStrength: 0.7,
    useShareProfile: true as const
  }
}

describe('effectiveSize', () => {
  it('returns inverse Simpson index', () => {
    expect(effectiveSize([0.5, 0.5])).toBeCloseTo(2)
    expect(effectiveSize([1])).toBeCloseTo(1)
    expect(effectiveSize([])).toBe(0)
  })
})

describe('poolSnapshot', () => {
  it('ranks eligible candidates with probabilities summing ~1', () => {
    const snap = poolSnapshot(baseInput(), 1)
    expect(snap.eligibleCount).toBeGreaterThan(0)
    const sum = snap.candidates
      .filter((c) => !c.filteredBy)
      .reduce((acc, c) => acc + c.probability, 0)
    expect(sum).toBeCloseTo(1, 5)
    expect(snap.effectiveSize).toBeGreaterThan(0)
  })
})

describe('comboMatrix', () => {
  it('returns 20 cells', () => {
    const cells = comboMatrix(baseInput(), 1)
    expect(cells).toHaveLength(20)
  })
})

describe('previewDelta', () => {
  it('detects rows lost when interval intensity cap tightens', () => {
    const before = baseInput()
    const after = {
      ...before,
      settings: makeSettings({ intervalMinutes: 15 })
    }
    const delta = previewDelta(before, after, 1)
    expect(delta.lost.length + delta.moved.length + delta.gained.length).toBeGreaterThan(0)
  })
})

describe('simulate', () => {
  it('is deterministic for the same seed', () => {
    const input = baseInput()
    const a = simulate(input, 50, 42)
    const b = simulate(input, 50, 42)
    expect(a.histogram).toEqual(b.histogram)
    expect(a.zoneShares).toEqual(b.zoneShares)
  })
})

describe('simulateWeek', () => {
  it('returns day strips and heatmap', () => {
    const week = simulateWeek(baseInput(), 7, 3, 7)
    expect(week.days).toHaveLength(7)
    expect(week.days[0]?.zones).toHaveLength(3)
    expect(week.heatmap.upper).toHaveLength(7)
  })
})
