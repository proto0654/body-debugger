import { existsSync } from 'fs'
import {
  emptyCatalogFile,
  migrateCustomExercises,
  normalizeCatalogFile,
  resolveCatalog,
  resolveCatalogV1,
  shippedCatalogV2,
  USER_MAIN_BATCH_ID
} from '../../shared/domain/catalog'
import { upgradeExercise, toExerciseV1, isValidExerciseV2, normalizeExerciseV2 } from '../../shared/domain/exercise-v2'
import { canApproveExercise } from '../../shared/domain/ai-proposal'
import { EXERCISE_CATALOG } from '../../shared/constants/exercises'
import type { CatalogBatch, CatalogFile, ExerciseOverride, ExerciseV2 } from '../../shared/types/exercise-v2'
import type { Exercise } from '../../shared/types/exercise'
import { isValidExercise } from '../../shared/validation/exercise'
import { readJsonEnvelope, writeJsonEnvelope } from './persistence/json-file'
import { getCatalogPath, getCustomExercisesPath, getChangesetsPath } from './persistence/paths'
import type { Changeset } from '../../shared/domain/changeset'
import { CHANGESET_HISTORY_LIMIT } from '../../shared/constants/catalog-tuning'

/**
 * Catalog V2 persistence (CATALOG-V2 §3).
 * Migrates custom-exercises.json once into catalog.json.
 */

let catalog: CatalogFile = emptyCatalogFile()
let changesets: Changeset[] = []
let overrides: Record<string, ExerciseOverride> = {}

export function setCatalogOverrides(next: Record<string, ExerciseOverride>): void {
  overrides = { ...next }
}

export function getCatalogOverrides(): Record<string, ExerciseOverride> {
  return { ...overrides }
}

export function loadCatalogStore(): void {
  migrateFromLegacyIfNeeded()
  catalog = normalizeCatalogFile(readJsonEnvelope<unknown>(getCatalogPath()))
  ensureUserMain()
  changesets = loadChangesets()
}

function migrateFromLegacyIfNeeded(): void {
  if (existsSync(getCatalogPath())) return
  const legacy = readJsonEnvelope<unknown>(getCustomExercisesPath())
  if (!Array.isArray(legacy)) {
    writeJsonEnvelope(getCatalogPath(), emptyCatalogFile())
    return
  }
  const exercises: Exercise[] = []
  for (const value of legacy) {
    if (isValidExercise(value)) exercises.push(value)
  }
  writeJsonEnvelope(getCatalogPath(), migrateCustomExercises(exercises))
}

function ensureUserMain(): void {
  if (!catalog.batches.some((batch) => batch.id === USER_MAIN_BATCH_ID)) {
    catalog = {
      ...catalog,
      batches: [
        {
          id: USER_MAIN_BATCH_ID,
          name: 'Мои упражнения',
          kind: 'user',
          createdAt: new Date().toISOString(),
          enabled: true,
          count: catalog.exercises.filter((e) => e.source.batchId === USER_MAIN_BATCH_ID).length
        },
        ...catalog.batches
      ]
    }
    persistCatalog()
  }
}

function loadChangesets(): Changeset[] {
  const raw = readJsonEnvelope<unknown>(getChangesetsPath())
  if (!Array.isArray(raw)) return []
  return raw.filter((value) => value && typeof value === 'object') as Changeset[]
}

function persistCatalog(): void {
  writeJsonEnvelope(getCatalogPath(), catalog)
}

function persistChangesets(): void {
  writeJsonEnvelope(getChangesetsPath(), changesets.slice(0, CHANGESET_HISTORY_LIMIT))
}

export function getCatalogFile(): CatalogFile {
  return {
    version: 2,
    exercises: catalog.exercises.map((exercise) => ({ ...exercise })),
    batches: catalog.batches.map((batch) => ({ ...batch }))
  }
}

export function getResolvedCatalogV2(): ReturnType<typeof resolveCatalog> {
  return resolveCatalog(shippedCatalogV2(), catalog.exercises, overrides, catalog.batches)
}

/** Shipped + user catalog as v1 Exercise[] for legacy callers. */
export function getAvailableCatalog(): Exercise[] {
  return resolveCatalogV1(shippedCatalogV2(), catalog.exercises, overrides, catalog.batches)
}

export function listCustomExercises(): Exercise[] {
  const legacyById = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise.category]))
  return catalog.exercises
    .filter((exercise) => exercise.status === 'active')
    .map((exercise) => toExerciseV1(exercise, legacyById.get(exercise.id)))
}

export function addCustomExercise(value: unknown): Exercise | null {
  if (!isValidExercise(value)) return null
  const taken = [
    ...EXERCISE_CATALOG.map((exercise) => exercise.id),
    ...catalog.exercises.map((exercise) => exercise.id)
  ]
  if (!canApproveExercise(value, taken).ok) return null

  const upgraded = upgradeExercise(value)
  const exercise: ExerciseV2 = {
    ...upgraded,
    source: {
      kind: 'user',
      batchId: USER_MAIN_BATCH_ID,
      createdAt: new Date().toISOString()
    }
  }
  catalog = {
    ...catalog,
    exercises: [...catalog.exercises, exercise],
    batches: catalog.batches.map((batch) =>
      batch.id === USER_MAIN_BATCH_ID ? { ...batch, count: batch.count + 1 } : batch
    )
  }
  try {
    persistCatalog()
    return toExerciseV1(exercise)
  } catch (error) {
    console.error('[catalog-store] failed to save an approved exercise', error)
    catalog = {
      ...catalog,
      exercises: catalog.exercises.filter((entry) => entry.id !== exercise.id)
    }
    return null
  }
}

export function removeCustomExercise(id: string): boolean {
  const index = catalog.exercises.findIndex(
    (exercise) => exercise.id === id && exercise.status === 'active'
  )
  if (index < 0) return false
  catalog = {
    ...catalog,
    exercises: catalog.exercises.map((exercise, i) =>
      i === index ? { ...exercise, status: 'archived' as const } : exercise
    )
  }
  try {
    persistCatalog()
    return true
  } catch (error) {
    console.error('[catalog-store] failed to archive an exercise', error)
    return false
  }
}

export function replaceCatalogFile(next: CatalogFile): void {
  catalog = normalizeCatalogFile(next)
  persistCatalog()
}

export function setExerciseStatus(id: string, status: 'active' | 'archived'): boolean {
  const index = catalog.exercises.findIndex((exercise) => exercise.id === id)
  if (index < 0) return false
  catalog.exercises[index] = { ...catalog.exercises[index]!, status }
  persistCatalog()
  return true
}

export function upsertBatch(batch: CatalogBatch): void {
  const index = catalog.batches.findIndex((entry) => entry.id === batch.id)
  if (index >= 0) catalog.batches[index] = batch
  else catalog.batches.push(batch)
  persistCatalog()
}

export function setBatchEnabled(id: string, enabled: boolean): boolean {
  const index = catalog.batches.findIndex((batch) => batch.id === id)
  if (index < 0) return false
  catalog.batches[index] = { ...catalog.batches[index]!, enabled }
  persistCatalog()
  return true
}

export function renameBatch(id: string, name: string): boolean {
  const index = catalog.batches.findIndex((batch) => batch.id === id)
  if (index < 0) return false
  catalog.batches[index] = { ...catalog.batches[index]!, name }
  persistCatalog()
  return true
}

export function listChangesets(): Changeset[] {
  return changesets.map((entry) => structuredClone(entry))
}

export function getChangeset(id: string): Changeset | null {
  const found = changesets.find((entry) => entry.id === id)
  return found ? structuredClone(found) : null
}

export function saveChangeset(changeset: Changeset): void {
  const index = changesets.findIndex((entry) => entry.id === changeset.id)
  if (index >= 0) changesets[index] = changeset
  else changesets.unshift(changeset)
  changesets = changesets.slice(0, CHANGESET_HISTORY_LIMIT)
  persistChangesets()
}

export function applyExercises(next: ExerciseV2[]): void {
  catalog = {
    ...catalog,
    exercises: next.filter(isValidExerciseV2).map(normalizeExerciseV2)
  }
  persistCatalog()
}

export function allocateExerciseId(batchId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'exercise'
  const base = `llm-${batchId}-${slug}`
  let id = base
  let n = 1
  const taken = new Set([
    ...EXERCISE_CATALOG.map((exercise) => exercise.id),
    ...catalog.exercises.map((exercise) => exercise.id)
  ])
  while (taken.has(id)) {
    n += 1
    id = `${base}-${n}`
  }
  return id
}
