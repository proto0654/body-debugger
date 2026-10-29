// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@shared/types/settings'
import type { UserProgress } from '@shared/types/progress'

const holder = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => holder.dir }
}))

type Store = typeof import('../../electron/main/persistence/store')

async function loadStore(): Promise<Store> {
  vi.resetModules()
  return import('../../electron/main/persistence/store')
}

function dataPath(name: string): string {
  return join(holder.dir, 'data', name)
}

const validSession = {
  id: 'session-1',
  exerciseId: 'neck-tilts',
  status: 'done',
  durationSec: 30,
  triggeredAt: '2026-10-30T09:00:00.000Z',
  completedAt: '2026-10-30T09:00:30.000Z'
}

const progress: UserProgress = {
  streak: { current: 1, max: 2 },
  characterStage: 1,
  characterBranch: 'posture',
  characterBuild: 'average',
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

beforeEach(() => {
  holder.dir = mkdtempSync(join(tmpdir(), 'body-debugger-load-'))
  mkdirSync(join(holder.dir, 'data'), { recursive: true })
})

afterEach(() => {
  rmSync(holder.dir, { recursive: true, force: true })
})

describe('store — load hardening', () => {
  it('drops malformed sessions from disk', async () => {
    writeFileSync(
      dataPath('sessions.json'),
      JSON.stringify({ version: 1, data: [validSession, { id: 'broken' }] })
    )

    const store = await loadStore()
    const snapshot = store.loadPersistence()

    expect(snapshot.sessions).toEqual([validSession])
  })

  it('normalizes settings and progress passed over IPC', async () => {
    const store = await loadStore()
    store.loadPersistence()

    const settings = store.updateSettings({
      severity: 'soft',
      themeId: 'rave',
      sound: { enabled: true, volume: 5, packId: 'rave' }
    } as unknown as AppSettings)

    expect(settings.settings.themeId).toBe('default')
    expect(settings.settings.sound).toEqual({ enabled: true, volume: 1, packId: 'default' })

    const next = store.updateProgress({
      ...progress,
      characterStage: 9 as never
    })
    expect(next.progress.characterStage).toBe(0)
  })
})
