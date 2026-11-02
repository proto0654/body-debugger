import { isMethod, isZone, METHODS, ZONES } from '../constants/catalog-axes'
import {
  TIMER_FLOOR_LOAD,
  TIMER_FLOOR_MOBILITY
} from '../constants/catalog-tuning'
import type { Exercise, ExerciseGroup } from '../types/exercise'
import type {
  ExerciseContext,
  ExerciseSource,
  ExerciseStatus,
  ExerciseTimer,
  ExerciseV2,
  ExerciseV2Derived,
  ExerciseV2Resolved,
  Intensity,
  Limitation,
  Method,
  Zone
} from '../types/exercise-v2'

const LIMITATIONS: readonly Limitation[] = [
  'neck',
  'shoulder',
  'wrist',
  'lower_back',
  'knee',
  'ankle'
]

const INTENSITIES: readonly Intensity[] = [1, 2, 3, 4, 5]

/** Category → method for upgradeExercise (unknown → mobility). */
const CATEGORY_METHOD: Record<string, Method> = {
  neck: 'mobility',
  shoulders: 'mobility',
  upperBack: 'mobility',
  chest: 'mobility',
  wrists: 'mobility',
  hips: 'mobility',
  legs: 'strength',
  lowerBack: 'mobility',
  core: 'strength',
  fullBody: 'cardio'
}

/** Equipment-group exercises: zone by category. */
const EQUIPMENT_ZONE: Record<string, Zone> = {
  shoulders: 'upper',
  upperBack: 'upper',
  fullBody: 'full',
  chest: 'upper',
  legs: 'lower',
  hips: 'lower',
  core: 'core'
}

export function round5(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 5
  return Math.max(5, Math.round(sec / 5) * 5)
}

export function timerFloor(method: Method): number {
  return method === 'mobility' || method === 'balance'
    ? TIMER_FLOOR_MOBILITY
    : TIMER_FLOOR_LOAD
}

export function dominantZone(zones: Partial<Record<Zone, number>>): Zone {
  let best: Zone = 'upper'
  let bestShare = -1
  for (const zone of ZONES) {
    const share = zones[zone] ?? 0
    if (share > bestShare) {
      bestShare = share
      best = zone
    }
  }
  return best
}

export function groupFromZone(zone: Zone, hasEquipment: boolean): ExerciseGroup {
  if (hasEquipment) return 'equipment'
  if (zone === 'core') return 'full'
  return zone
}

export function deriveExerciseFields(exercise: ExerciseV2): ExerciseV2Derived {
  const zone = dominantZone(exercise.zones)
  return {
    dominantZone: zone,
    group: groupFromZone(zone, Boolean(exercise.equipment?.length)),
    category: exercise.source.kind === 'shipped'
      ? legacyCategoryHint(exercise)
      : `${exercise.method}:${zone}`,
    durationSec: exercise.timer.defaultSec
  }
}

/** Keep the original v1 category when upgrading shipped exercises. */
function legacyCategoryHint(exercise: ExerciseV2): string {
  return `${exercise.method}:${dominantZone(exercise.zones)}`
}

export function resolveExercise(exercise: ExerciseV2): ExerciseV2Resolved {
  return { ...exercise, ...deriveExerciseFields(exercise) }
}

/**
 * Upgrade v1 (or partially retagged) exercise to V2.
 * Explicit V2 fields on the input win over §2.1 defaults (CATALOG-V2 hand-retag).
 */
export function upgradeExercise(v1: Exercise): ExerciseV2 {
  const d = Math.max(5, Math.round(v1.durationSec))
  const method = v1.method ?? methodFromV1(v1)
  const zones = v1.zones ?? zonesFromV1(v1)
  const minSec = Math.max(
    timerFloor(method),
    v1.timer?.minSec ?? round5(0.7 * d)
  )
  const maxSec = Math.max(minSec, v1.timer?.maxSec ?? round5(1.5 * d))
  const defaultSec = Math.min(
    maxSec,
    Math.max(minSec, v1.timer?.defaultSec ?? d)
  )
  const perSide = v1.timer?.perSide ?? v1.perSide

  return {
    id: v1.id,
    title: v1.title.slice(0, 40),
    description: v1.description.slice(0, 220),
    method,
    zones,
    intensity: clampIntensity(v1.intensity ?? v1.difficulty),
    difficulty: clampIntensity(v1.difficulty),
    timer: {
      minSec,
      defaultSec,
      maxSec,
      ...(perSide ? { perSide: true } : {})
    },
    ...(v1.equipment ? { equipment: [...v1.equipment] } : {}),
    context: v1.context ?? { posture: 'standing', quiet: true, noSweat: true },
    ...(v1.avoidIf && v1.avoidIf.length > 0 ? { avoidIf: [...v1.avoidIf] } : {}),
    ...(v1.modificationOf ? { modificationOf: v1.modificationOf } : {}),
    emojiFallback: v1.emojiFallback,
    ...(v1.imageKey ? { imageKey: v1.imageKey } : {}),
    status: 'active',
    source: { kind: 'shipped' }
  }
}

function methodFromV1(v1: Exercise): Method {
  const focus = v1.focus ?? []
  if (focus.includes('striking')) return 'striking'
  if (focus.includes('strength')) return 'strength'
  if (focus.includes('light_athletics')) return 'cardio'
  if (focus.includes('balance')) return 'balance'
  if (focus.includes('mobility')) return 'mobility'
  return CATEGORY_METHOD[v1.category] ?? 'mobility'
}

function zonesFromV1(v1: Exercise): Partial<Record<Zone, number>> {
  if (v1.group === 'upper') return { upper: 1 }
  if (v1.group === 'lower') {
    if (v1.category === 'lowerBack') return { core: 0.7, lower: 0.3 }
    return { lower: 1 }
  }
  if (v1.group === 'full') {
    if (v1.category === 'core') return { core: 1 }
    return { full: 1 }
  }
  // equipment
  const zone = EQUIPMENT_ZONE[v1.category] ?? 'full'
  return { [zone]: 1 }
}

function clampIntensity(value: number): Intensity {
  const n = Math.round(value)
  if (n <= 1) return 1
  if (n >= 5) return 5
  return n as Intensity
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isLimitation(value: unknown): value is Limitation {
  return typeof value === 'string' && (LIMITATIONS as readonly string[]).includes(value)
}

function isIntensity(value: unknown): value is Intensity {
  return typeof value === 'number' && INTENSITIES.includes(value as Intensity)
}

function isTimer(value: unknown): value is ExerciseTimer {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  if (typeof t.minSec !== 'number' || typeof t.defaultSec !== 'number' || typeof t.maxSec !== 'number') {
    return false
  }
  if (!(t.minSec > 0 && t.defaultSec > 0 && t.maxSec > 0)) return false
  if (!(t.minSec <= t.defaultSec && t.defaultSec <= t.maxSec)) return false
  if (t.perSide !== undefined && typeof t.perSide !== 'boolean') return false
  return true
}

function isContext(value: unknown): value is ExerciseContext {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return (
    (c.posture === 'seated' || c.posture === 'standing' || c.posture === 'floor') &&
    typeof c.quiet === 'boolean' &&
    typeof c.noSweat === 'boolean'
  )
}

function isSource(value: unknown): value is ExerciseSource {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  if (s.kind !== 'shipped' && s.kind !== 'user' && s.kind !== 'llm') return false
  if (s.batchId !== undefined && typeof s.batchId !== 'string') return false
  if (s.model !== undefined && typeof s.model !== 'string') return false
  if (s.createdAt !== undefined && typeof s.createdAt !== 'string') return false
  return true
}

function normalizeZones(
  raw: unknown
): { ok: true; zones: Partial<Record<Zone, number>> } | { ok: false } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false }
  const zones: Partial<Record<Zone, number>> = {}
  let sum = 0
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isZone(key)) return { ok: false }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return { ok: false }
    if (value === 0) continue
    zones[key] = value
    sum += value
  }
  if (sum <= 0) return { ok: false }
  if (sum < 0.95 || sum > 1.05) return { ok: false }
  if (Math.abs(sum - 1) > 1e-9) {
    for (const zone of ZONES) {
      if (zones[zone] !== undefined) zones[zone] = (zones[zone] as number) / sum
    }
  }
  return { ok: true, zones }
}

/**
 * Type-guard / validator for ExerciseV2 (CATALOG-V2 §7.1 reject rules).
 * Invalid values are rejected, not clamped (except zone-sum normalize within ±0.05).
 */
export function isValidExerciseV2(value: unknown): value is ExerciseV2 {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>

  if (!isNonEmptyString(e.id)) return false
  if (!isNonEmptyString(e.title) || e.title.length > 40) return false
  if (!isNonEmptyString(e.description) || e.description.length > 220) return false
  if (!isMethod(e.method)) return false
  if (!isIntensity(e.intensity) || !isIntensity(e.difficulty)) return false
  if (!isTimer(e.timer)) return false
  if (e.timer.minSec < timerFloor(e.method)) return false
  if (!isContext(e.context)) return false
  if (e.status !== 'active' && e.status !== 'archived') return false
  if (!isSource(e.source)) return false

  const zones = normalizeZones(e.zones)
  if (!zones.ok) return false

  if (e.reps !== undefined) {
    if (!e.reps || typeof e.reps !== 'object') return false
    const r = e.reps as Record<string, unknown>
    if (typeof r.min !== 'number' || typeof r.max !== 'number') return false
    if (!(r.min > 0 && r.max >= r.min)) return false
  }

  if (e.equipment !== undefined) {
    if (
      !Array.isArray(e.equipment) ||
      !e.equipment.every((x) => typeof x === 'string' && x.trim().length > 0)
    ) {
      return false
    }
  }

  if (e.avoidIf !== undefined) {
    if (!Array.isArray(e.avoidIf) || !e.avoidIf.every(isLimitation)) return false
  }

  if (e.modificationOf !== undefined && typeof e.modificationOf !== 'string') return false
  if (!isNonEmptyString(e.emojiFallback)) return false
  if (e.imageKey !== undefined && typeof e.imageKey !== 'string') return false

  return true
}

/** Mutating normalize after a successful isValidExerciseV2 check (zone sum). */
export function normalizeExerciseV2(value: ExerciseV2): ExerciseV2 {
  const zones = normalizeZones(value.zones)
  if (!zones.ok) return value
  return { ...value, zones: zones.zones }
}

export function assertExerciseV2(value: unknown): ExerciseV2 {
  if (!isValidExerciseV2(value)) throw new Error('Invalid ExerciseV2 payload')
  return normalizeExerciseV2(value)
}

/** Convert a resolved V2 exercise into the v1 shape for legacy popup / stats consumers. */
export function toExerciseV1(
  exercise: ExerciseV2,
  legacyCategory?: string
): Exercise {
  const derived = deriveExerciseFields(exercise)
  return {
    id: exercise.id,
    title: exercise.title,
    description: exercise.description,
    durationSec: derived.durationSec,
    difficulty: exercise.difficulty,
    category: legacyCategory ?? derived.category,
    ...(exercise.equipment ? { equipment: [...exercise.equipment] } : {}),
    ...(exercise.imageKey ? { imageKey: exercise.imageKey } : {}),
    emojiFallback: exercise.emojiFallback,
    ...(exercise.modificationOf ? { modificationOf: exercise.modificationOf } : {}),
    group: derived.group,
    focus: methodToFocus(exercise.method),
    ...(exercise.timer.perSide ? { perSide: true } : {})
  }
}

function methodToFocus(method: Method): Exercise['focus'] {
  if (method === 'cardio') return ['light_athletics']
  return [method]
}

export function defaultShippedSource(): ExerciseSource {
  return { kind: 'shipped' }
}

export function defaultActiveStatus(): ExerciseStatus {
  return 'active'
}

export { ZONES, METHODS, LIMITATIONS }
