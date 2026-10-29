// @vitest-environment node
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonEnvelope, writeJsonEnvelope } from '../../electron/main/persistence/json-file'
import type { WeightEntry } from '@shared/types/weight'

const holder = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => holder.dir }
}))

type Store = typeof import('../../electron/main/persistence/store')

/** Fresh module state: the store keeps everything in module-level objects. */
async function loadStore(): Promise<Store> {
  vi.resetModules()
  return import('../../electron/main/persistence/store')
}

function dataPath(name: string): string {
  return join(holder.dir, 'data', name)
}

function storedWeights(): WeightEntry[] | null {
  return readJsonEnvelope<WeightEntry[]>(dataPath('weights.json'))
}

beforeEach(() => {
  holder.dir = mkdtempSync(join(tmpdir(), 'body-debugger-store-'))
})

afterEach(() => {
  rmSync(holder.dir, { recursive: true, force: true })
})

describe('store — weight history', () => {
  it('records the weight of a completed session once, even if the session is replayed', async () => {
    const store = await loadStore()
    const session = {
      id: 'session-1',
      exerciseId: 'neck-circles',
      status: 'done' as const,
      durationSec: 30,
      triggeredAt: '2026-10-30T09:00:00.000Z',
      completedAt: '2026-10-30T09:01:00.000Z',
      weightKg: 72.55
    }

    store.appendSession(session)
    store.appendSession(session)

    expect(store.getSnapshot().weights).toEqual([
      {
        id: 'weight:session:session-1',
        at: '2026-10-30T09:01:00.000Z',
        weightKg: 72.6,
        sessionId: 'session-1'
      }
    ])
    expect(storedWeights()).toHaveLength(1)
  })

  it('ignores sessions that are not done or carry no weight', async () => {
    const store = await loadStore()

    store.appendSession({
      id: 'session-2',
      exerciseId: 'hips',
      status: 'skipped',
      durationSec: 30,
      triggeredAt: '2026-10-30T09:00:00.000Z',
      weightKg: 70
    })

    expect(store.getSnapshot().weights).toEqual([])
    expect(existsSync(dataPath('weights.json'))).toBe(false)
  })

  it('adds a manual measurement and rejects an out-of-range one', async () => {
    const store = await loadStore()

    const rejected = store.addWeightEntry({ weightKg: 500 })
    expect(rejected.weights).toEqual([])
    expect(existsSync(dataPath('weights.json'))).toBe(false)

    const snapshot = store.addWeightEntry({ weightKg: '81.44', at: '2026-10-29T08:00:00.000Z' })
    expect(snapshot.weights).toHaveLength(1)
    expect(snapshot.weights[0]).toMatchObject({
      at: '2026-10-29T08:00:00.000Z',
      weightKg: 81.4
    })
    expect(storedWeights()).toHaveLength(1)
  })

  it('does not duplicate a measurement for the same session', async () => {
    const store = await loadStore()

    store.addWeightEntry({ weightKg: 72, sessionId: 'session-3' })
    const snapshot = store.addWeightEntry({ weightKg: 73, sessionId: 'session-3' })

    expect(snapshot.weights).toHaveLength(1)
    expect(snapshot.weights[0].weightKg).toBe(72)
  })

  it('removes an entry and keeps the rest on disk', async () => {
    const store = await loadStore()
    const first = store.addWeightEntry({ weightKg: 72 }).weights[0]
    store.addWeightEntry({ weightKg: 71 })

    const snapshot = store.removeWeightEntry(first.id)

    expect(snapshot.weights).toHaveLength(1)
    expect(snapshot.weights[0].weightKg).toBe(71)
    expect(storedWeights()).toHaveLength(1)
  })

  it('clears the source session when its measurement is deleted', async () => {
    const store = await loadStore()
    store.appendSession({
      id: 'session-1',
      exerciseId: 'neck-circles',
      status: 'done',
      durationSec: 30,
      triggeredAt: '2026-10-30T09:00:00.000Z',
      completedAt: '2026-10-30T09:01:00.000Z',
      weightKg: 72
    })

    store.removeWeightEntry('weight:session:session-1')
    expect(store.getSnapshot().sessions[0].weightKg).toBeUndefined()

    // A fresh load must not resurrect the deleted measurement through backfill.
    const reloaded = await loadStore()
    const snapshot = reloaded.loadPersistence()

    expect(snapshot.weights).toEqual([])
    expect(snapshot.sessions[0].weightKg).toBeUndefined()
  })

  it('backfills sessions measured before the weight file existed', async () => {
    writeJsonEnvelope(dataPath('sessions.json'), [
      {
        id: 'session-old',
        exerciseId: 'neck-circles',
        status: 'done',
        durationSec: 30,
        triggeredAt: '2026-10-01T09:00:00.000Z',
        completedAt: '2026-10-01T09:01:00.000Z',
        weightKg: 75
      }
    ])

    const store = await loadStore()
    const snapshot = store.loadPersistence()

    expect(snapshot.weights).toEqual([
      {
        id: 'weight:session:session-old',
        at: '2026-10-01T09:01:00.000Z',
        weightKg: 75,
        sessionId: 'session-old'
      }
    ])
    expect(storedWeights()).toHaveLength(1)
  })

  it('drops malformed entries read from disk', async () => {
    writeJsonEnvelope(dataPath('weights.json'), [
      { id: 'ok', at: '2026-10-01T09:00:00.000Z', weightKg: 75 },
      { id: 'bad-range', at: '2026-10-01T09:00:00.000Z', weightKg: 900 },
      { at: '2026-10-01T09:00:00.000Z', weightKg: 75 }
    ])

    const store = await loadStore()
    const snapshot = store.loadPersistence()

    expect(snapshot.weights).toHaveLength(1)
    expect(snapshot.weights[0].id).toBe('ok')
  })

  it('returns a copy of the weight list', async () => {
    const store = await loadStore()
    const snapshot = store.addWeightEntry({ weightKg: 72 })
    snapshot.weights[0].weightKg = 1

    expect(store.getSnapshot().weights[0].weightKg).toBe(72)
  })
})
