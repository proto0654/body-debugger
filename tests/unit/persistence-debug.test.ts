// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonEnvelope } from '../../electron/main/persistence/json-file'
import type { Session } from '@shared/types/session'
import type { AppSettings } from '@shared/types/settings'
import type { UserProgress } from '@shared/types/progress'
import { makeSession, makeSettings } from '../fixtures'

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

const PROGRESS: UserProgress = {
  streak: { current: 5, max: 9 },
  characterStage: 5,
  characterBranch: 'power',
  characterBuild: 'lean',
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

function doneSession(id: string): Session {
  return makeSession({ id, exerciseId: 'neck-tilts', status: 'done' })
}

beforeEach(() => {
  holder.dir = mkdtempSync(join(tmpdir(), 'body-debugger-debug-'))
})

afterEach(() => {
  rmSync(holder.dir, { recursive: true, force: true })
})

describe('store — debug scenario apply', () => {
  it('replaces sessions, normalizes settings and recomputes the character', async () => {
    const store = await loadStore()
    const payload = {
      sessions: [doneSession('a'), doneSession('b'), doneSession('c'), { id: 'broken' }],
      settings: { ...makeSettings(), themeId: 'rave' } as AppSettings,
      progress: PROGRESS
    }

    const snapshot = store.applyDebugState(payload)

    expect(snapshot.sessions.map((session) => session.id)).toEqual(['a', 'b', 'c'])
    expect(snapshot.settings.themeId).toBe('default')
    expect(snapshot.progress.characterStage).toBe(1)
    expect(snapshot.progress.characterBranch).toBe('posture')
    expect(snapshot.progress.streak).toEqual({ current: 5, max: 9 })
    expect(snapshot.progress.characterBuild).toBe('lean')

    expect(readJsonEnvelope<Session[]>(dataPath('sessions.json'))).toHaveLength(3)
    expect(readJsonEnvelope<AppSettings>(dataPath('settings.json'))?.themeId).toBe('default')
    expect(readJsonEnvelope<UserProgress>(dataPath('progress.json'))?.characterStage).toBe(1)
  })

  it('clears history with an empty scenario instead of resurrecting old sessions', async () => {
    const store = await loadStore()
    store.appendSession(doneSession('old'))

    const snapshot = store.applyDebugState({
      sessions: [],
      settings: makeSettings(),
      progress: PROGRESS
    })

    expect(snapshot.sessions).toEqual([])
    expect(snapshot.progress.characterStage).toBe(0)
    expect(snapshot.progress.characterBranch).toBe('neutral')
    expect(readJsonEnvelope<Session[]>(dataPath('sessions.json'))).toEqual([])
  })

  it('keeps weights untouched', async () => {
    const store = await loadStore()
    store.addWeightEntry({ weightKg: 72.5 })

    store.applyDebugState({
      sessions: [doneSession('a')],
      settings: makeSettings(),
      progress: PROGRESS
    })

    expect(store.getSnapshot().weights).toHaveLength(1)
  })
})
