import { EXERCISE_CATALOG } from '../constants/exercises'
import type {
  CatalogBatch,
  CatalogFile,
  ExerciseOverride,
  ExerciseV2,
  ExerciseV2Resolved
} from '../types/exercise-v2'
import {
  isValidExerciseV2,
  normalizeExerciseV2,
  resolveExercise,
  toExerciseV1,
  upgradeExercise
} from './exercise-v2'
import type { Exercise } from '../types/exercise'

export const USER_MAIN_BATCH_ID = 'user-main'
export const LEGACY_IMPORT_BATCH_ID = 'legacy-import'
export const SHIPPED_BATCH_ID = 'shipped'

export function shippedCatalogV2(): ExerciseV2[] {
  return EXERCISE_CATALOG.map((exercise) => upgradeExercise(exercise))
}

export function shippedBatch(): CatalogBatch {
  return {
    id: SHIPPED_BATCH_ID,
    name: 'Встроенные',
    kind: 'shipped',
    createdAt: '1970-01-01T00:00:00.000Z',
    enabled: true,
    count: EXERCISE_CATALOG.length
  }
}

export function userMainBatch(count = 0): CatalogBatch {
  return {
    id: USER_MAIN_BATCH_ID,
    name: 'Мои упражнения',
    kind: 'user',
    createdAt: new Date(0).toISOString(),
    enabled: true,
    count
  }
}

export function emptyCatalogFile(): CatalogFile {
  return {
    version: 2,
    exercises: [],
    batches: [userMainBatch(0)]
  }
}

/**
 * Resolve the effective catalog the picker reads (CATALOG-V2 §3).
 *
 * Layers: shipped (immutable) < user/llm catalog < overrides.
 * Shipped ids always win over user ids with the same id.
 * A user fork with `modificationOf = <shipped id>` shadows that shipped exercise.
 * Archived or override-disabled exercises are omitted.
 */
export function resolveCatalog(
  shipped: readonly ExerciseV2[],
  user: readonly ExerciseV2[],
  overrides: Readonly<Record<string, ExerciseOverride>> = {},
  batches: readonly CatalogBatch[] = []
): ExerciseV2Resolved[] {
  const disabledBatches = new Set(
    batches.filter((batch) => !batch.enabled && batch.id !== SHIPPED_BATCH_ID).map((b) => b.id)
  )

  const shippedById = new Map(shipped.map((exercise) => [exercise.id, exercise]))
  const forksByTarget = new Map<string, ExerciseV2>()
  const userOnly: ExerciseV2[] = []

  for (const exercise of user) {
    if (!isValidExerciseV2(exercise)) continue
    const normalized = normalizeExerciseV2(exercise)
    if (normalized.status !== 'active') continue
    if (normalized.source.batchId && disabledBatches.has(normalized.source.batchId)) continue
    if (overrides[normalized.id]?.disabled) continue

    if (normalized.modificationOf && shippedById.has(normalized.modificationOf)) {
      forksByTarget.set(normalized.modificationOf, normalized)
      continue
    }

    if (shippedById.has(normalized.id)) {
      // Shipped id always wins — drop the colliding user row.
      continue
    }
    userOnly.push(normalized)
  }

  const resolved: ExerciseV2Resolved[] = []
  for (const exercise of shipped) {
    if (exercise.status !== 'active') continue
    if (overrides[exercise.id]?.disabled) continue
    const fork = forksByTarget.get(exercise.id)
    resolved.push(resolveExercise(fork ?? exercise))
  }
  for (const exercise of userOnly) {
    resolved.push(resolveExercise(exercise))
  }
  return resolved
}

/** Legacy v1 list for existing popup / stats consumers. */
export function resolveCatalogV1(
  shipped: readonly ExerciseV2[],
  user: readonly ExerciseV2[],
  overrides: Readonly<Record<string, ExerciseOverride>> = {},
  batches: readonly CatalogBatch[] = []
): Exercise[] {
  const legacyById = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise.category]))
  return resolveCatalog(shipped, user, overrides, batches).map((exercise) =>
    toExerciseV1(exercise, legacyById.get(exercise.id))
  )
}

/** One-shot migration of approved AI exercises into a catalog file. */
export function migrateCustomExercises(custom: readonly Exercise[]): CatalogFile {
  const now = new Date().toISOString()
  const exercises: ExerciseV2[] = []
  const seen = new Set(EXERCISE_CATALOG.map((exercise) => exercise.id))

  for (const entry of custom) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    const upgraded = upgradeExercise(entry)
    exercises.push({
      ...upgraded,
      source: {
        kind: entry.id.startsWith('ai-') || entry.id.startsWith('llm-') ? 'llm' : 'user',
        batchId: LEGACY_IMPORT_BATCH_ID,
        createdAt: now
      }
    })
  }

  const batches: CatalogBatch[] = [
    userMainBatch(0),
    {
      id: LEGACY_IMPORT_BATCH_ID,
      name: 'Импорт AI',
      kind: 'legacy-import',
      createdAt: now,
      enabled: true,
      count: exercises.length
    }
  ]

  return { version: 2, exercises, batches }
}

export function normalizeCatalogFile(raw: unknown): CatalogFile {
  if (!raw || typeof raw !== 'object') return emptyCatalogFile()
  const data = raw as Record<string, unknown>
  if (data.version !== 2) return emptyCatalogFile()

  const exercises: ExerciseV2[] = []
  if (Array.isArray(data.exercises)) {
    for (const value of data.exercises) {
      if (!isValidExerciseV2(value)) continue
      exercises.push(normalizeExerciseV2(value))
    }
  }

  const batches: CatalogBatch[] = []
  const seen = new Set<string>()
  if (Array.isArray(data.batches)) {
    for (const value of data.batches) {
      const batch = normalizeBatch(value)
      if (!batch || seen.has(batch.id)) continue
      seen.add(batch.id)
      batches.push(batch)
    }
  }

  if (!seen.has(USER_MAIN_BATCH_ID)) {
    batches.unshift(
      userMainBatch(exercises.filter((e) => e.source.batchId === USER_MAIN_BATCH_ID).length)
    )
  }

  return { version: 2, exercises, batches }
}

function normalizeBatch(value: unknown): CatalogBatch | null {
  if (!value || typeof value !== 'object') return null
  const b = value as Record<string, unknown>
  if (typeof b.id !== 'string' || !b.id.trim()) return null
  if (typeof b.name !== 'string' || !b.name.trim()) return null
  if (b.kind !== 'legacy-import' && b.kind !== 'llm' && b.kind !== 'user' && b.kind !== 'shipped') {
    return null
  }
  if (typeof b.createdAt !== 'string') return null
  return {
    id: b.id,
    name: b.name,
    kind: b.kind,
    createdAt: b.createdAt,
    ...(typeof b.model === 'string' ? { model: b.model } : {}),
    enabled: b.enabled !== false,
    count: typeof b.count === 'number' && Number.isFinite(b.count) ? Math.max(0, Math.floor(b.count)) : 0
  }
}

export function applyOverridesToTimer(
  timer: ExerciseV2['timer'],
  override: ExerciseOverride | undefined
): ExerciseV2['timer'] {
  if (!override?.timer) return timer
  return {
    ...timer,
    ...override.timer,
    minSec: override.timer.minSec ?? timer.minSec,
    defaultSec: override.timer.defaultSec ?? timer.defaultSec,
    maxSec: override.timer.maxSec ?? timer.maxSec
  }
}
