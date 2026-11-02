// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  migrateCustomExercises,
  resolveCatalog,
  shippedCatalogV2
} from '@shared/domain/catalog'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import type { ExerciseV2 } from '@shared/types/exercise-v2'

describe('resolveCatalog', () => {
  it('lets shipped ids win over colliding user rows', () => {
    const shipped = shippedCatalogV2()
    const collision: ExerciseV2 = {
      ...upgradeExercise(EXERCISE_CATALOG[0]!),
      title: 'Подделка',
      source: { kind: 'user', batchId: 'user-main' }
    }
    const resolved = resolveCatalog(shipped, [collision])
    const found = resolved.find((exercise) => exercise.id === EXERCISE_CATALOG[0]!.id)
    expect(found?.title).toBe(EXERCISE_CATALOG[0]!.title)
  })

  it('lets a fork shadow the shipped exercise', () => {
    const shipped = shippedCatalogV2()
    const target = shipped[0]!
    const fork: ExerciseV2 = {
      ...target,
      id: 'fork-1',
      title: 'Форк',
      modificationOf: target.id,
      source: { kind: 'user', batchId: 'user-main' }
    }
    const resolved = resolveCatalog(shipped, [fork])
    const found = resolved.find((exercise) => exercise.id === 'fork-1' || exercise.modificationOf === target.id)
    expect(found?.title).toBe('Форк')
    expect(resolved.some((exercise) => exercise.id === target.id && !exercise.modificationOf)).toBe(false)
  })

  it('excludes archived exercises', () => {
    const shipped = shippedCatalogV2()
    const archived: ExerciseV2 = {
      ...upgradeExercise(EXERCISE_CATALOG[0]!),
      id: 'user-archived',
      status: 'archived',
      source: { kind: 'user', batchId: 'user-main' }
    }
    const resolved = resolveCatalog(shipped, [archived])
    expect(resolved.some((exercise) => exercise.id === 'user-archived')).toBe(false)
  })

  it('migrates custom exercises into a legacy-import batch', () => {
    const custom = [EXERCISE_CATALOG[0]!].map((exercise) => ({
      ...exercise,
      id: 'ai-custom-1',
      title: 'Кастом'
    }))
    const file = migrateCustomExercises(custom)
    expect(file.version).toBe(2)
    expect(file.exercises).toHaveLength(1)
    expect(file.batches.some((batch) => batch.kind === 'legacy-import')).toBe(true)
  })
})
