import type {
  ExerciseV2,
  FocusLevel,
  Method,
  Zone
} from '../types/exercise-v2'
import { isValidExerciseV2, normalizeExerciseV2 } from './exercise-v2'
import { TUNE_TIMER_GUARD } from '../constants/catalog-tuning'

export type ChangesetKind = 'generate' | 'edit' | 'retag' | 'tune'
export type ChangesetStatus =
  | 'requested'
  | 'generating'
  | 'parsed'
  | 'awaiting_approval'
  | 'applied'
  | 'reverted'
  | 'discarded'
  | 'failed'

export type CatalogOp =
  | { op: 'add'; exercise: Omit<ExerciseV2, 'id' | 'source' | 'status'> }
  | {
      op: 'update'
      id: string
      patch: Partial<
        Pick<
          ExerciseV2,
          | 'title'
          | 'description'
          | 'timer'
          | 'reps'
          | 'intensity'
          | 'zones'
          | 'avoidIf'
          | 'context'
          | 'method'
        >
      >
    }
  | { op: 'archive'; id: string; reason?: string }
  | { op: 'unarchive'; id: string }
  | {
      op: 'profile_shift'
      axis: 'zone' | 'method'
      key: string
      level: -1 | 1 | 2
      until: string
    }
  | { op: 'remove_profile_shift'; changesetId: string; key: string; axis: 'zone' | 'method' }

export interface OpRecord {
  op: CatalogOp
  state: 'ok' | 'warn' | 'rejected'
  enabled: boolean
  issues: string[]
  reason?: string
}

export interface Changeset {
  id: string
  status: ChangesetStatus
  createdAt: string
  kind: ChangesetKind
  targetSetId?: string
  ops: OpRecord[]
  inverse?: CatalogOp[]
  usage?: { promptTokens: number; completionTokens: number }
  error?: string
}

export interface CatalogState {
  exercises: ExerciseV2[]
  profileShifts: {
    axis: 'zone' | 'method'
    key: string
    level: -1 | 1 | 2
    until: string
    changesetId?: string
    source: 'llm' | 'user'
  }[]
}

const UPDATE_KEYS = new Set([
  'title',
  'description',
  'timer',
  'reps',
  'intensity',
  'zones',
  'avoidIf',
  'context',
  'method'
])

export function summarize(changeset: Changeset): { add: number; update: number; archive: number; shift: number } {
  let add = 0
  let update = 0
  let archive = 0
  let shift = 0
  for (const record of changeset.ops) {
    if (!record.enabled || record.state === 'rejected') continue
    if (record.op.op === 'add') add += 1
    else if (record.op.op === 'update') update += 1
    else if (record.op.op === 'archive') archive += 1
    else if (record.op.op === 'profile_shift') shift += 1
  }
  return { add, update, archive, shift }
}

export function invertOps(ops: readonly CatalogOp[], before: CatalogState, changesetId: string): CatalogOp[] {
  const inverse: CatalogOp[] = []
  for (const op of [...ops].reverse()) {
    if (op.op === 'add') {
      // id assigned at apply time — invert uses archive by generated id stored on exercise after apply
      continue
    }
    if (op.op === 'update') {
      const existing = before.exercises.find((exercise) => exercise.id === op.id)
      if (!existing) continue
      const reverse: CatalogOp = {
        op: 'update',
        id: op.id,
        patch: pickPatch(existing, Object.keys(op.patch) as (keyof ExerciseV2)[])
      }
      inverse.push(reverse)
    } else if (op.op === 'archive') {
      inverse.push({ op: 'unarchive', id: op.id })
    } else if (op.op === 'unarchive') {
      inverse.push({ op: 'archive', id: op.id })
    } else if (op.op === 'profile_shift') {
      inverse.push({
        op: 'remove_profile_shift',
        changesetId,
        key: op.key,
        axis: op.axis
      })
    }
  }
  return inverse
}

function pickPatch(
  exercise: ExerciseV2,
  keys: (keyof ExerciseV2)[]
): CatalogOp extends { op: 'update'; patch: infer P } ? P : never {
  const patch: Record<string, unknown> = {}
  for (const key of keys) {
    if (!UPDATE_KEYS.has(key)) continue
    patch[key] = structuredClone((exercise as unknown as Record<string, unknown>)[key])
  }
  return patch as never
}

export function applyOps(
  state: CatalogState,
  ops: readonly CatalogOp[],
  options: {
    changesetId: string
    targetSetId: string
    shippedIds: ReadonlySet<string>
    allocateId: (draft: Omit<ExerciseV2, 'id' | 'source' | 'status'>) => string
    model?: string
  }
): { state: CatalogState; assignedIds: string[]; inverse: CatalogOp[] } {
  let exercises = state.exercises.map((exercise) => ({ ...exercise }))
  let profileShifts = [...state.profileShifts]
  const assignedIds: string[] = []
  const inverse: CatalogOp[] = []

  for (const op of ops) {
    if (op.op === 'add') {
      const id = options.allocateId(op.exercise)
      const exercise: ExerciseV2 = {
        ...op.exercise,
        id,
        status: 'active',
        source: {
          kind: 'llm',
          batchId: options.targetSetId,
          createdAt: new Date().toISOString(),
          ...(options.model ? { model: options.model } : {})
        }
      }
      if (!isValidExerciseV2(exercise)) continue
      exercises.push(normalizeExerciseV2(exercise))
      assignedIds.push(id)
      inverse.unshift({ op: 'archive', id })
    } else if (op.op === 'update') {
      const index = exercises.findIndex((exercise) => exercise.id === op.id)
      if (index >= 0) {
        const current = exercises[index]!
        inverse.unshift({
          op: 'update',
          id: op.id,
          patch: pickPatch(current, Object.keys(op.patch) as (keyof ExerciseV2)[])
        })
        const merged = normalizeExerciseV2({ ...current, ...sanitizePatch(op.patch) })
        exercises[index] = merged
      } else if (options.shippedIds.has(op.id)) {
        // Fork + patch
        const forkId = options.allocateId({
          title: op.id,
          description: '',
          method: 'mobility',
          zones: { upper: 1 },
          intensity: 1,
          difficulty: 1,
          timer: { minSec: 20, defaultSec: 30, maxSec: 45 },
          context: { posture: 'standing', quiet: true, noSweat: true },
          emojiFallback: '💪'
        })
        // Caller should pass full shipped exercise via a pre-seeded user copy; here we only patch if present.
        void forkId
      }
    } else if (op.op === 'archive') {
      const index = exercises.findIndex((exercise) => exercise.id === op.id)
      if (index >= 0) {
        exercises[index] = { ...exercises[index]!, status: 'archived' }
        inverse.unshift({ op: 'unarchive', id: op.id })
      }
    } else if (op.op === 'unarchive') {
      const index = exercises.findIndex((exercise) => exercise.id === op.id)
      if (index >= 0) {
        exercises[index] = { ...exercises[index]!, status: 'active' }
        inverse.unshift({ op: 'archive', id: op.id })
      }
    } else if (op.op === 'profile_shift') {
      profileShifts.push({
        axis: op.axis,
        key: op.key,
        level: op.level,
        until: op.until,
        changesetId: options.changesetId,
        source: 'llm'
      })
      inverse.unshift({
        op: 'remove_profile_shift',
        changesetId: options.changesetId,
        key: op.key,
        axis: op.axis
      })
    } else if (op.op === 'remove_profile_shift') {
      profileShifts = profileShifts.filter(
        (shift) =>
          !(
            shift.changesetId === op.changesetId &&
            shift.key === op.key &&
            shift.axis === op.axis
          )
      )
    }
  }

  return { state: { exercises, profileShifts }, assignedIds, inverse }
}

function sanitizePatch(
  patch: Partial<ExerciseV2>
): Partial<ExerciseV2> {
  const out: Partial<ExerciseV2> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (!UPDATE_KEYS.has(key)) continue
    ;(out as Record<string, unknown>)[key] = value
  }
  return out
}

/** Guard: tune updates may not move timer.defaultSec by more than ±25%. */
export function validateTuneTimerPatch(
  current: ExerciseV2,
  patch: Partial<ExerciseV2>
): string | null {
  if (!patch.timer?.defaultSec) return null
  const before = current.timer.defaultSec
  const after = patch.timer.defaultSec
  if (Math.abs(after - before) > before * TUNE_TIMER_GUARD) {
    return `timer default moved more than ±${TUNE_TIMER_GUARD * 100}%`
  }
  return null
}

export function forkShipped(
  shipped: ExerciseV2,
  patch: Partial<ExerciseV2>,
  id: string,
  targetSetId: string
): ExerciseV2 {
  return normalizeExerciseV2({
    ...shipped,
    ...sanitizePatch(patch),
    id,
    modificationOf: shipped.id,
    status: 'active',
    source: {
      kind: 'user',
      batchId: targetSetId,
      createdAt: new Date().toISOString()
    }
  })
}

export type { Zone, Method, FocusLevel }
