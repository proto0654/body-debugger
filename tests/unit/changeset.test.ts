// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import {
  applyOps,
  forkShipped,
  invertOps,
  summarize,
  validateTuneTimerPatch,
  type CatalogState
} from '@shared/domain/changeset'

describe('changeset summarize', () => {
  it('counts enabled ops by kind', () => {
    const summary = summarize({
      id: 'c1',
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
      kind: 'edit',
      ops: [
        {
          op: { op: 'add', exercise: {} as never },
          state: 'ok',
          enabled: true,
          issues: []
        },
        {
          op: { op: 'archive', id: 'x' },
          state: 'rejected',
          enabled: false,
          issues: ['bad']
        },
        {
          op: { op: 'update', id: 'y', patch: { title: 't' } },
          state: 'warn',
          enabled: true,
          issues: []
        }
      ]
    })
    expect(summary).toEqual({ add: 1, update: 1, archive: 0, shift: 0 })
  })
})

describe('changeset invertOps', () => {
  it('builds reverse patches for updates and archives', () => {
    const exercise = upgradeExercise(EXERCISE_CATALOG[0]!)
    const before: CatalogState = { exercises: [exercise], profileShifts: [] }
    const inverse = invertOps(
      [{ op: 'update', id: exercise.id, patch: { title: 'Changed' } }],
      before,
      'cs-1'
    )
    expect(inverse[0]).toEqual({
      op: 'update',
      id: exercise.id,
      patch: { title: exercise.title }
    })
  })
})

describe('changeset applyOps', () => {
  it('adds exercises and archives by inverse archive op placeholder', () => {
    const exercise = upgradeExercise(EXERCISE_CATALOG[0]!)
    const { id: _id, source: _source, status: _status, ...draft } = exercise
    const before: CatalogState = { exercises: [], profileShifts: [] }
    const { state, assignedIds, inverse } = applyOps(
      before,
      [{ op: 'add', exercise: draft }],
      {
        changesetId: 'cs-add',
        targetSetId: 'batch-1',
        shippedIds: new Set(),
        allocateId: () => 'new-id'
      }
    )
    expect(state.exercises).toHaveLength(1)
    expect(state.exercises[0]?.id).toBe('new-id')
    expect(assignedIds).toEqual(['new-id'])
    expect(inverse[0]).toEqual({ op: 'archive', id: 'new-id' })
  })
})

describe('changeset forkShipped', () => {
  it('creates a user fork with modificationOf', () => {
    const shipped = upgradeExercise(EXERCISE_CATALOG[0]!)
    const fork = forkShipped(shipped, { title: 'Fork title' }, 'fork-id', 'user-main')
    expect(fork.modificationOf).toBe(shipped.id)
    expect(fork.title).toBe('Fork title')
    expect(fork.source.kind).toBe('user')
  })
})

describe('changeset applyOps ↔ invertOps round-trip', () => {
  it('restores the original catalog after inverse apply', () => {
    const exercise = upgradeExercise(EXERCISE_CATALOG[0]!)
    const before: CatalogState = { exercises: [exercise], profileShifts: [] }
    const { state: afterAdd, inverse: inverseAdd } = applyOps(
      before,
      [
        {
          op: 'add',
          exercise: {
            title: 'Новое',
            description: 'Сделай короткое упражнение и держи спину ровно.',
            method: 'mobility',
            zones: { upper: 1 },
            intensity: 1,
            difficulty: 1,
            timer: { minSec: 20, defaultSec: 30, maxSec: 40 },
            context: { posture: 'standing', quiet: true, noSweat: true },
            emojiFallback: '🧘'
          }
        },
        { op: 'update', id: exercise.id, patch: { title: 'Временно' } },
        {
          op: 'profile_shift',
          axis: 'zone',
          key: 'upper',
          level: 2,
          until: new Date(Date.now() + 7 * 86_400_000).toISOString()
        }
      ],
      {
        changesetId: 'cs-round',
        targetSetId: 'user-main',
        shippedIds: new Set([exercise.id]),
        allocateId: () => 'llm-user-main-novo'
      }
    )
    expect(afterAdd.exercises).toHaveLength(2)
    expect(afterAdd.profileShifts).toHaveLength(1)

    const { state: restored } = applyOps(afterAdd, inverseAdd, {
      changesetId: 'cs-round-inv',
      targetSetId: 'user-main',
      shippedIds: new Set([exercise.id]),
      allocateId: () => 'unused'
    })
    const active = restored.exercises.filter((item) => item.status === 'active')
    expect(active.map((item) => item.id)).toEqual([exercise.id])
    expect(active[0]?.title).toBe(exercise.title)
    expect(restored.exercises.find((item) => item.id === 'llm-user-main-novo')?.status).toBe(
      'archived'
    )
    expect(restored.profileShifts).toEqual([])
  })
})

describe('validateTuneTimerPatch', () => {
  it('rejects large timer moves', () => {
    const exercise = upgradeExercise(EXERCISE_CATALOG[0]!)
    const issue = validateTuneTimerPatch(exercise, {
      timer: { ...exercise.timer, defaultSec: exercise.timer.defaultSec * 2 }
    })
    expect(issue).toMatch(/timer default/)
  })
})
