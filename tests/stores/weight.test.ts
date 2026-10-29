import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWeightStore } from '@/stores/weight'
import { makeSettings, makeWeightEntry, NOW } from '../fixtures'
import { normalizeWeightEntry } from '@shared/domain/weight'
import type { DataSnapshot } from '@shared/types/persistence'
import type { WeightEntry } from '@shared/types/weight'

const progress = {
  streak: { current: 0, max: 0 },
  characterStage: 0 as const,
  characterBranch: 'neutral' as const,
  characterBuild: 'average' as const,
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

function snapshot(weights: WeightEntry[]): DataSnapshot {
  return { settings: makeSettings(), progress, sessions: [], weights }
}

const addWeight = vi.fn(async (payload: { weightKg: number; at?: string }) => {
  // Main re-validates and rounds before writing; mirror that here.
  const normalized = normalizeWeightEntry(payload)
  return snapshot([
    makeWeightEntry({ weightKg: normalized?.weightKg ?? payload.weightKg, at: payload.at })
  ])
})
const removeWeight = vi.fn(async (_payload: { id: string }) => snapshot([]))

beforeEach(() => {
  setActivePinia(createPinia())
  addWeight.mockClear()
  removeWeight.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { addWeight, removeWeight }
  })
})

describe('weight store', () => {
  it('hydrates a copy of the history', () => {
    const store = useWeightStore()
    const source = [makeWeightEntry({ weightKg: 72 })]
    store.hydrate(source)

    source.push(makeWeightEntry({ weightKg: 71 }))

    expect(store.entries).toHaveLength(1)
  })

  it('exposes the latest measurement and the chart series', () => {
    const store = useWeightStore()
    store.hydrate([
      makeWeightEntry({ weightKg: 74, at: NOW.toISOString() }),
      makeWeightEntry({ weightKg: 72, at: new Date(NOW.getTime() - 86_400_000).toISOString() })
    ])

    expect(store.latest?.weightKg).toBe(74)
    expect(store.series(NOW).map((point) => point.weightKg)).toEqual([72, 74])
  })

  it('lists recent entries newest first with a limit', () => {
    const store = useWeightStore()
    store.hydrate([
      makeWeightEntry({ weightKg: 70, at: '2026-10-01T08:00:00.000Z' }),
      makeWeightEntry({ weightKg: 71, at: '2026-10-20T08:00:00.000Z' }),
      makeWeightEntry({ weightKg: 72, at: '2026-10-10T08:00:00.000Z' })
    ])

    expect(store.recent(2).map((entry) => entry.weightKg)).toEqual([71, 72])
  })

  it('rejects an out-of-range value before calling main', async () => {
    const store = useWeightStore()

    await expect(store.add(500)).resolves.toBe(false)
    expect(addWeight).not.toHaveBeenCalled()
    expect(store.entries).toHaveLength(0)
  })

  it('stores a valid measurement and hydrates the returned snapshot', async () => {
    const store = useWeightStore()

    await expect(store.add(72.55)).resolves.toBe(true)

    expect(addWeight).toHaveBeenCalledWith({ weightKg: 72.55, at: undefined })
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0].weightKg).toBe(72.6)
  })

  it('removes an entry through main', async () => {
    const store = useWeightStore()
    const entry = makeWeightEntry({ weightKg: 72 })
    store.hydrate([entry])

    await store.remove(entry.id)

    expect(removeWeight).toHaveBeenCalledWith({ id: entry.id })
    expect(store.entries).toHaveLength(0)
  })

  it('keeps working when the preload bridge is absent', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    const store = useWeightStore()

    await expect(store.add(72)).resolves.toBe(false)
    await expect(store.remove('weight-1')).resolves.toBeUndefined()
  })
})
