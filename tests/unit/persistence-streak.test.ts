// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@shared/types/session'

const holder = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => holder.dir }
}))

type Store = typeof import('../../electron/main/persistence/store')

async function loadStore(): Promise<Store> {
  vi.resetModules()
  return import('../../electron/main/persistence/store')
}

function at(daysBack: number): string {
  return new Date(2026, 9, 30 - daysBack, 10).toISOString()
}

function done(daysBack: number, id: string): Session {
  return {
    id,
    exerciseId: 'neck-tilts',
    status: 'done',
    durationSec: 30,
    triggeredAt: at(daysBack),
    completedAt: at(daysBack)
  }
}

beforeEach(() => {
  holder.dir = mkdtempSync(join(tmpdir(), 'body-debugger-streak-'))
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 30, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(holder.dir, { recursive: true, force: true })
})

describe('store — streak', () => {
  it('counts unique consecutive days on done, not raw sessions', async () => {
    const store = await loadStore()
    store.appendSession(done(0, 'a'))
    store.appendSession(done(0, 'b'))
    store.appendSession(done(1, 'c'))
    store.applyDoneSession()

    expect(store.getProgress().streak).toEqual({ current: 2, max: 2 })
  })

  it('keeps the historical max when the current run breaks', async () => {
    const store = await loadStore()
    store.appendSession(done(5, 'a'))
    store.appendSession(done(6, 'b'))
    store.appendSession(done(7, 'c'))
    const snapshot = store.applyDoneSession()
    expect(snapshot.progress.streak).toEqual({ current: 0, max: 3 })
  })
})
