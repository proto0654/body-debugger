import {
  isMethod,
  isZone,
  LIMITATION_LABELS,
  LIMITATIONS,
  METHOD_LABELS,
  METHODS,
  ZONE_LABELS,
  ZONES
} from '../constants/catalog-axes'
import type { ExerciseV2, Limitation, Method, Zone } from '../types/exercise-v2'
import { isValidExerciseV2, normalizeExerciseV2, timerFloor } from './exercise-v2'
import type { CatalogOp, OpRecord } from './changeset'

function foldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function buildLabelAliases<T extends string>(
  ids: readonly T[],
  labels: Record<T, string>,
  extras: Record<string, T>
): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [alias, id] of Object.entries(extras)) out[foldKey(alias)] = id
  for (const id of ids) {
    out[foldKey(id)] = id
    out[foldKey(labels[id])] = id
  }
  return out
}

/** UI labels + common Russian/legacy variants the model invents. */
const METHOD_ALIASES = buildLabelAliases(METHODS, METHOD_LABELS, {
  stretch: 'mobility',
  stretching: 'mobility',
  yoga: 'mobility',
  растяжки: 'mobility',
  растяжка: 'mobility',
  'растяжки и йога': 'mobility',
  йога: 'mobility',
  flexibility: 'mobility',
  силовая: 'strength',
  сила: 'strength',
  strength: 'strength',
  power: 'strength',
  силовые: 'strength',
  cardio: 'cardio',
  athletics: 'cardio',
  light_athletics: 'cardio',
  'легкая атлетика': 'cardio',
  'лёгкая атлетика': 'cardio',
  кардио: 'cardio',
  лёгкая: 'cardio',
  легкая: 'cardio',
  aerobic: 'cardio',
  striking: 'striking',
  ударка: 'striking',
  ударная: 'striking',
  удары: 'striking',
  ударные: 'striking',
  boxing: 'striking',
  punches: 'striking',
  kickboxing: 'striking',
  balance: 'balance',
  баланс: 'balance',
  equilibrium: 'balance',
  равновесие: 'balance'
})

const ZONE_ALIASES = buildLabelAliases(ZONES, ZONE_LABELS, {
  верх: 'upper',
  'верх тела': 'upper',
  upper: 'upper',
  'upper body': 'upper',
  плечи: 'upper',
  шея: 'upper',
  core: 'core',
  кор: 'core',
  пояс: 'core',
  'кор и пояс': 'core',
  'нижняя спина': 'core',
  abs: 'core',
  lower: 'lower',
  низ: 'lower',
  'низ тела': 'lower',
  'lower body': 'lower',
  ноги: 'lower',
  бёдра: 'lower',
  бедра: 'lower',
  full: 'full',
  комплекс: 'full',
  'full body': 'full',
  'всё тело': 'full',
  'все тело': 'full',
  whole: 'full'
})

const LIMITATION_ALIASES = buildLabelAliases(LIMITATIONS, LIMITATION_LABELS, {
  neck: 'neck',
  шея: 'neck',
  shoulder: 'shoulder',
  плечо: 'shoulder',
  плечи: 'shoulder',
  wrist: 'wrist',
  запястье: 'wrist',
  запястья: 'wrist',
  lower_back: 'lower_back',
  'lower back': 'lower_back',
  поясница: 'lower_back',
  спина: 'lower_back',
  knee: 'knee',
  колено: 'knee',
  колени: 'knee',
  ankle: 'ankle',
  голеностоп: 'ankle',
  щиколотка: 'ankle'
})

const POSTURE_ALIASES: Record<string, 'seated' | 'standing' | 'floor'> = {
  seated: 'seated',
  sitting: 'seated',
  sit: 'seated',
  сидя: 'seated',
  сидячее: 'seated',
  standing: 'standing',
  stand: 'standing',
  стоя: 'standing',
  стоячее: 'standing',
  floor: 'floor',
  lying: 'floor',
  prone: 'floor',
  пол: 'floor',
  лёжа: 'floor',
  лежа: 'floor',
  наполу: 'floor',
  'на полу': 'floor'
}

export function normalizeMethodId(value: unknown): Method | null {
  if (typeof value !== 'string') return null
  const key = foldKey(value)
  if (isMethod(key)) return key
  return METHOD_ALIASES[key] ?? null
}

export function normalizeZoneId(value: unknown): Zone | null {
  if (typeof value !== 'string') return null
  const key = foldKey(value)
  if (isZone(key)) return key
  return ZONE_ALIASES[key] ?? null
}

export function normalizeLimitationId(value: unknown): Limitation | null {
  if (typeof value !== 'string') return null
  const key = foldKey(value).replace(/\s+/g, '_')
  if ((LIMITATIONS as readonly string[]).includes(key)) return key as Limitation
  return LIMITATION_ALIASES[foldKey(value)] ?? LIMITATION_ALIASES[key] ?? null
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const key = foldKey(value)
    if (key === 'true' || key === 'yes' || key === 'да' || key === '1') return true
    if (key === 'false' || key === 'no' || key === 'нет' || key === '0') return false
  }
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  return null
}

function coerceIntensity(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = coerceNumber(value)
  if (n === null) return null
  const rounded = Math.round(n)
  if (rounded < 1 || rounded > 5) return null
  return rounded as 1 | 2 | 3 | 4 | 5
}

/** Coerce labels / numeric strings the model commonly emits before schema validation. */
export function normalizeDraftEnums(draft: Record<string, unknown>): Record<string, unknown> {
  const next = { ...draft }
  const method = normalizeMethodId(next.method)
  if (method) next.method = method

  const intensity = coerceIntensity(next.intensity)
  if (intensity !== null) next.intensity = intensity
  const difficulty = coerceIntensity(next.difficulty)
  if (difficulty !== null) next.difficulty = difficulty

  if (next.zones && typeof next.zones === 'object' && !Array.isArray(next.zones)) {
    const zones: Partial<Record<Zone, number>> = {}
    for (const [rawKey, rawValue] of Object.entries(next.zones as Record<string, unknown>)) {
      const zone = normalizeZoneId(rawKey)
      const share = coerceNumber(rawValue)
      if (!zone || share === null || share < 0) continue
      zones[zone] = (zones[zone] ?? 0) + share
    }
    next.zones = zones
  }

  if (next.timer && typeof next.timer === 'object' && !Array.isArray(next.timer)) {
    const timer = { ...(next.timer as Record<string, unknown>) }
    for (const key of ['minSec', 'defaultSec', 'maxSec'] as const) {
      const n = coerceNumber(timer[key])
      if (n !== null) timer[key] = n
    }
    const perSide = coerceBoolean(timer.perSide)
    if (perSide !== null) timer.perSide = perSide

    // LLM often emits minSec 20–25 for every method; bump to the method floor
    // and keep min ≤ default ≤ max so validation does not reject the whole draft.
    const methodForFloor = normalizeMethodId(next.method)
    if (
      methodForFloor &&
      typeof timer.minSec === 'number' &&
      typeof timer.defaultSec === 'number' &&
      typeof timer.maxSec === 'number'
    ) {
      const floor = timerFloor(methodForFloor)
      let minSec = Math.max(timer.minSec, floor)
      let defaultSec = Math.max(timer.defaultSec, minSec)
      let maxSec = Math.max(timer.maxSec, defaultSec)
      timer.minSec = minSec
      timer.defaultSec = defaultSec
      timer.maxSec = maxSec
    }
    next.timer = timer
  }

  if (next.context && typeof next.context === 'object' && !Array.isArray(next.context)) {
    const context = { ...(next.context as Record<string, unknown>) }
    if (typeof context.posture === 'string') {
      const posture = POSTURE_ALIASES[foldKey(context.posture)]
      if (posture) context.posture = posture
    }
    const quiet = coerceBoolean(context.quiet)
    if (quiet !== null) context.quiet = quiet
    const noSweat = coerceBoolean(context.noSweat)
    if (noSweat !== null) context.noSweat = noSweat
    next.context = context
  }

  if (Array.isArray(next.avoidIf)) {
    next.avoidIf = next.avoidIf
      .map((tag) => normalizeLimitationId(tag))
      .filter((tag): tag is Limitation => tag != null)
  }

  return next
}

function validationFailureHint(draft: Record<string, unknown>, cleaned: Record<string, unknown>): string {
  const hints: string[] = []
  if (typeof draft.method === 'string' && !normalizeMethodId(draft.method)) {
    hints.push(`method "${draft.method}" → use ${METHODS.join('|')}`)
  }
  if (cleaned.zones && typeof cleaned.zones === 'object') {
    const keys = Object.keys(cleaned.zones as object)
    if (keys.length === 0) hints.push('zones empty after label normalize')
  }
  if (cleaned.timer && typeof cleaned.timer === 'object') {
    const timer = cleaned.timer as Record<string, unknown>
    const method = normalizeMethodId(cleaned.method)
    if (
      method &&
      typeof timer.minSec === 'number' &&
      timer.minSec < timerFloor(method)
    ) {
      hints.push(`minSec ${timer.minSec} < floor ${timerFloor(method)} for ${method}`)
    }
  }
  return hints.length ? ` (${hints.join('; ')})` : ''
}

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
  const cleaned = normalizeDraftEnums({ ...draft })
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
    return rejected(
      `exercise failed ExerciseV2 validation${validationFailureHint(draft, cleaned)}`,
      reason
    )
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
  const rawMethod =
    typeof (op.patch as { method?: unknown }).method === 'string'
      ? String((op.patch as { method: string }).method)
      : null
  const patch = normalizeDraftEnums({ ...(op.patch as Record<string, unknown>) })
  delete patch.id
  delete patch.source
  delete patch.equipment
  delete patch.status

  if (patch.method !== undefined && !isMethod(patch.method)) {
    return rejected(rawMethod ? `unknown method "${rawMethod}"` : 'unknown method')
  }
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
  const key =
    op.axis === 'zone'
      ? normalizeZoneId(op.key)
      : op.axis === 'method'
        ? normalizeMethodId(op.key)
        : null
  if (op.axis === 'zone' && !key) return rejected('unknown zone')
  if (op.axis === 'method' && !key) return rejected('unknown method')
  if (op.level !== -1 && op.level !== 1 && op.level !== 2) return rejected('bad level')
  if (typeof op.until !== 'string') return rejected('missing until')
  return {
    op: {
      op: 'profile_shift',
      axis: op.axis,
      key: key!,
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

type DupCandidate = Pick<ExerciseV2, 'id' | 'method' | 'zones' | 'title' | 'description'>

function dominantZoneOf(exercise: Pick<ExerciseV2, 'zones'>): string | undefined {
  return Object.entries(exercise.zones).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0]
}

function isLikelyDuplicate(draft: Omit<DupCandidate, 'id'>, other: DupCandidate): string | null {
  if (other.method !== draft.method) return null
  if (dominantZoneOf(other) !== dominantZoneOf(draft)) return null
  const sameTitle = other.title.toLowerCase() === draft.title.toLowerCase()
  const descScore = jaccardTokens(other.description, draft.description)
  // Coverage fills share method+zone; only warn on a near-copy description,
  // an identical title, or both title and description looking alike.
  if (sameTitle || descScore > 0.85 || (descScore > 0.6 && jaccardTokens(other.title, draft.title) > 0.7)) {
    return other.id
  }
  return null
}

export function flagDuplicates(ops: OpRecord[], existing: ExerciseV2[]): OpRecord[] {
  const seenAdds: DupCandidate[] = []
  return ops.map((record, index) => {
    if (record.op.op !== 'add' || record.state === 'rejected') return record
    const draft = record.op.exercise
    for (const exercise of [...existing, ...seenAdds]) {
      const duplicateId = isLikelyDuplicate(draft, exercise)
      if (duplicateId) {
        seenAdds.push({ id: `draft:${index}`, ...draft })
        return {
          ...record,
          state: 'warn',
          issues: [...record.issues, `likely duplicate of ${duplicateId}`]
        }
      }
    }
    seenAdds.push({ id: `draft:${index}`, ...draft })
    return record
  })
}
