import { isMethod, isZone } from '../constants/catalog-axes'
import type { ExerciseV2 } from '../types/exercise-v2'
import { isValidExerciseV2, normalizeExerciseV2, timerFloor } from './exercise-v2'
import type { CatalogOp, OpRecord } from './changeset'

/** Extract JSON from model output that may include prose or markdown fences. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('empty LLM response')

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  const candidate = fence ? fence[1]!.trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    const arrayStart = candidate.indexOf('[')
    const arrayEnd = candidate.lastIndexOf(']')
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(candidate.slice(arrayStart, arrayEnd + 1))
    }
    throw new Error('LLM response is not JSON')
  }
}

export function parseGenerateExercises(raw: string): OpRecord[] {
  const data = extractJson(raw)
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { exercises?: unknown }).exercises)
      ? (data as { exercises: unknown[] }).exercises
      : data && typeof data === 'object' && Array.isArray((data as { ops?: unknown }).ops)
        ? null
        : null

  if (list) {
    return list.map((value) => exerciseToAddOp(value))
  }

  if (data && typeof data === 'object' && Array.isArray((data as { ops?: unknown }).ops)) {
    return parseOps((data as { ops: unknown[] }).ops)
  }

  throw new Error('generate response missing exercises/ops')
}

export function parseOpsPayload(raw: string): OpRecord[] {
  const data = extractJson(raw)
  if (!data || typeof data !== 'object') throw new Error('ops payload must be an object')
  const ops = (data as { ops?: unknown }).ops
  if (!Array.isArray(ops)) throw new Error('ops payload missing ops array')
  return parseOps(ops)
}

function parseOps(ops: unknown[]): OpRecord[] {
  return ops.map((value) => {
    if (!value || typeof value !== 'object') {
      return rejected('op is not an object')
    }
    const op = value as Record<string, unknown>
    if (op.op === 'add') return exerciseToAddOp(op.exercise, typeof op.reason === 'string' ? op.reason : undefined)
    if (op.op === 'update') return parseUpdate(op)
    if (op.op === 'archive') {
      if (typeof op.id !== 'string' || !op.id.trim()) return rejected('archive missing id')
      return {
        op: { op: 'archive', id: op.id, ...(typeof op.reason === 'string' ? { reason: op.reason } : {}) },
        state: 'ok',
        enabled: true,
        issues: [],
        ...(typeof op.reason === 'string' ? { reason: op.reason } : {})
      }
    }
    if (op.op === 'profile_shift') return parseProfileShift(op)
    return rejected(`unknown op ${String(op.op)}`)
  })
}

function exerciseToAddOp(value: unknown, reason?: string): OpRecord {
  if (!value || typeof value !== 'object') return rejected('add.exercise missing')
  const draft = value as Record<string, unknown>
  // Strip fields the LLM must not set
  const cleaned = { ...draft }
  delete cleaned.id
  delete cleaned.source
  delete cleaned.status

  const candidate = {
    ...cleaned,
    id: 'tmp-validate',
    status: 'active',
    source: { kind: 'llm' }
  }

  if (!isValidExerciseV2(candidate)) {
    return rejected('exercise failed ExerciseV2 validation', reason)
  }

  const normalized = normalizeExerciseV2(candidate)
  const { id: _id, source: _source, status: _status, ...exercise } = normalized
  const issues = warnExercise(normalized)
  return {
    op: { op: 'add', exercise },
    state: issues.length ? 'warn' : 'ok',
    enabled: true,
    issues,
    ...(reason ? { reason } : {})
  }
}

function parseUpdate(op: Record<string, unknown>): OpRecord {
  if (typeof op.id !== 'string' || !op.id.trim()) return rejected('update missing id')
  if (!op.patch || typeof op.patch !== 'object') return rejected('update missing patch')
  const patch = { ...(op.patch as Record<string, unknown>) }
  delete patch.id
  delete patch.source
  delete patch.equipment
  delete patch.status

  if (patch.method !== undefined && !isMethod(patch.method)) return rejected('unknown method')
  if (patch.zones !== undefined) {
    if (!patch.zones || typeof patch.zones !== 'object') return rejected('bad zones')
    for (const key of Object.keys(patch.zones as object)) {
      if (!isZone(key)) return rejected(`unknown zone ${key}`)
    }
  }

  const issues: string[] = []
  if (typeof patch.title === 'string' && patch.title.length > 40) {
    return rejected('title > 40')
  }
  if (typeof patch.description === 'string' && patch.description.length > 220) {
    return rejected('description > 220')
  }

  return {
    op: { op: 'update', id: op.id, patch: patch as CatalogOp extends { op: 'update'; patch: infer P } ? P : never },
    state: issues.length ? 'warn' : 'ok',
    enabled: true,
    issues,
    ...(typeof op.reason === 'string' ? { reason: op.reason } : {})
  }
}

function parseProfileShift(op: Record<string, unknown>): OpRecord {
  if (op.axis !== 'zone' && op.axis !== 'method') return rejected('bad profile_shift axis')
  if (typeof op.key !== 'string') return rejected('bad profile_shift key')
  if (op.axis === 'zone' && !isZone(op.key)) return rejected('unknown zone')
  if (op.axis === 'method' && !isMethod(op.key)) return rejected('unknown method')
  if (op.level !== -1 && op.level !== 1 && op.level !== 2) return rejected('bad level')
  if (typeof op.until !== 'string') return rejected('missing until')
  return {
    op: {
      op: 'profile_shift',
      axis: op.axis,
      key: op.key,
      level: op.level,
      until: op.until
    },
    state: 'ok',
    enabled: true,
    issues: [],
    ...(typeof op.reason === 'string' ? { reason: op.reason } : {})
  }
}

function warnExercise(exercise: ExerciseV2): string[] {
  const issues: string[] = []
  if (exercise.intensity >= 4 && !(exercise.avoidIf && exercise.avoidIf.length)) {
    issues.push('intensity ≥ 4 without avoidIf')
  }
  if (exercise.context.posture === 'seated' && exercise.intensity >= 4) {
    issues.push('seated with intensity ≥ 4')
  }
  if (exercise.method === 'strength' && !/спин|колен|локт|плеч|таз|корпус/i.test(exercise.description)) {
    issues.push('strength exercise without an obvious safety cue')
  }
  if (exercise.timer.minSec < timerFloor(exercise.method)) {
    issues.push('minSec below method floor')
  }
  return issues
}

function rejected(issue: string, reason?: string): OpRecord {
  return {
    op: { op: 'archive', id: '__invalid__' },
    state: 'rejected',
    enabled: false,
    issues: [issue],
    ...(reason ? { reason } : {})
  }
}

export function jaccardTokens(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const token of Array.from(ta)) if (tb.has(token)) inter += 1
  return inter / (ta.size + tb.size - inter)
}

export function flagDuplicates(ops: OpRecord[], existing: ExerciseV2[]): OpRecord[] {
  return ops.map((record) => {
    if (record.op.op !== 'add' || record.state === 'rejected') return record
    const draft = record.op.exercise
    const dominant = Object.entries(draft.zones).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0]
    for (const exercise of existing) {
      if (exercise.method !== draft.method) continue
      const otherDom = Object.entries(exercise.zones).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0]
      if (otherDom !== dominant) continue
      const similarTitle =
        exercise.title.toLowerCase() === draft.title.toLowerCase() ||
        jaccardTokens(exercise.description, draft.description) > 0.6
      if (similarTitle) {
        return {
          ...record,
          state: 'warn',
          issues: [...record.issues, `likely duplicate of ${exercise.id}`]
        }
      }
    }
    return record
  })
}
