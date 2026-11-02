// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonEnvelope } from '../../electron/main/persistence/json-file'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import type { CatalogFile } from '@shared/types/exercise-v2'
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

describe('main custom exercise store (catalog.json)', () => {
  it('adds a validated exercise into catalog.json and exposes it after shipped', async () => {
    const store = await loadModule()
    store.loadCustomExercises()

    const added = store.addCustomExercise(proposal)

    expect(added?.id).toBe(proposal.id)
    expect(added?.title).toBe(proposal.title)
    expect(store.listCustomExercises().map((exercise) => exercise.id)).toEqual([proposal.id])
    const available = store.getAvailableCatalog()
    expect(available).toHaveLength(EXERCISE_CATALOG.length + 1)
    expect(available.some((exercise) => exercise.id === 'ai-neck-reset')).toBe(true)
    const file = readJsonEnvelope<CatalogFile>(dataPath('catalog.json'))
    expect(file?.exercises.some((exercise) => exercise.id === proposal.id)).toBe(true)
  })

  it('rejects invalid payloads, duplicates and shipped ids', async () => {
    const store = await loadModule()
    store.loadCustomExercises()

    expect(store.addCustomExercise({ ...proposal, title: '' })).toBeNull()
    expect(store.addCustomExercise({ ...proposal, id: EXERCISE_CATALOG[0]!.id })).toBeNull()
    expect(store.addCustomExercise(proposal)?.id).toBe(proposal.id)
    expect(store.addCustomExercise(proposal)).toBeNull()
    expect(store.listCustomExercises()).toHaveLength(1)
  })

  it('migrates legacy custom-exercises.json once into catalog.json', async () => {
    writeFileSync(
      dataPath('custom-exercises.json'),
      JSON.stringify({
        version: 1,
        data: [
          proposal,
          { ...proposal, id: proposal.id, title: 'Duplicate' },
          { id: 'broken' },
          { ...proposal, id: EXERCISE_CATALOG[0]!.id }
        ]
      })
    )

    const store = await loadModule()
    store.loadCustomExercises()

    expect(store.listCustomExercises().map((exercise) => exercise.id)).toEqual([proposal.id])
    expect(existsSync(dataPath('catalog.json'))).toBe(true)
  })

  it('archives an approved exercise instead of deleting the record', async () => {
    const store = await loadModule()
    store.loadCustomExercises()
    store.addCustomExercise(proposal)

    expect(store.removeCustomExercise(proposal.id)).toBe(true)
    expect(store.removeCustomExercise(proposal.id)).toBe(false)
    expect(store.listCustomExercises()).toEqual([])
    expect(existsSync(dataPath('catalog.json'))).toBe(true)
  })
})
