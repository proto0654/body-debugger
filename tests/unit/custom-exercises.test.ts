// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonEnvelope } from '../../electron/main/persistence/json-file'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import type { Exercise } from '@shared/types/exercise'

const holder = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => holder.dir }
}))

type Store = typeof import('../../electron/main/custom-exercises')

async function loadModule(): Promise<Store> {
  vi.resetModules()
  return import('../../electron/main/custom-exercises')
}

const proposal: Exercise = {
  id: 'ai-neck-reset',
  title: 'Сброс шеи',
  description: 'Медленные кивки и повороты без боли.',
  durationSec: 40,
  difficulty: 2,
  category: 'neck',
  group: 'upper',
  emojiFallback: '🧘',
  focus: ['mobility']
}

function dataPath(name: string): string {
  return join(holder.dir, 'data', name)
}

beforeEach(() => {
  holder.dir = mkdtempSync(join(tmpdir(), 'body-debugger-custom-'))
  mkdirSync(join(holder.dir, 'data'), { recursive: true })
})

afterEach(() => {
  rmSync(holder.dir, { recursive: true, force: true })
})

describe('main custom exercise store', () => {
  it('adds a validated exercise and exposes it after the shipped catalog', async () => {
    const store = await loadModule()
    store.loadCustomExercises()

    const added = store.addCustomExercise(proposal)

    expect(added).toEqual(proposal)
    expect(store.listCustomExercises()).toEqual([proposal])
    const available = store.getAvailableCatalog()
    expect(available).toHaveLength(EXERCISE_CATALOG.length + 1)
    expect(available[available.length - 1].id).toBe('ai-neck-reset')
    expect(readJsonEnvelope<Exercise[]>(dataPath('custom-exercises.json'))).toEqual([proposal])
  })

  it('rejects invalid payloads, duplicates and shipped ids', async () => {
    const store = await loadModule()
    store.loadCustomExercises()

    expect(store.addCustomExercise({ ...proposal, title: '' })).toBeNull()
    expect(store.addCustomExercise({ ...proposal, id: EXERCISE_CATALOG[0].id })).toBeNull()
    expect(store.addCustomExercise(proposal)).toEqual(proposal)
    expect(store.addCustomExercise(proposal)).toBeNull()
    expect(store.listCustomExercises()).toHaveLength(1)
  })

  it('drops malformed and shipped-id entries on load', async () => {
    const store = await loadModule()
    writeFileSync(
      dataPath('custom-exercises.json'),
      JSON.stringify({
        version: 1,
        data: [
          proposal,
          { ...proposal, id: proposal.id, title: 'Duplicate' },
          { id: 'broken' },
          { ...proposal, id: EXERCISE_CATALOG[0].id }
        ]
      })
    )

    store.loadCustomExercises()

    expect(store.listCustomExercises()).toEqual([proposal])
  })

  it('removes an approved exercise', async () => {
    const store = await loadModule()
    store.loadCustomExercises()
    store.addCustomExercise(proposal)

    expect(store.removeCustomExercise(proposal.id)).toBe(true)
    expect(store.removeCustomExercise(proposal.id)).toBe(false)
    expect(store.listCustomExercises()).toEqual([])
    expect(existsSync(dataPath('custom-exercises.json'))).toBe(true)
  })
})
