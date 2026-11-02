import { ZONES } from '../constants/catalog-axes'
import {
  BOOST_CLAMP_MAX,
  BOOST_CLAMP_MIN,
  LEVEL_MULT,
  METHOD_REPEAT_MULT,
  NEGLECT_CAP,
  NEGLECT_DAYS,
  OVERLAP_PREV_WEIGHT,
  OVERLAP_TODAY_WEIGHT,
  PROFILE_STRENGTH_DEFAULT,
  PROFILE_STRENGTH_FOCUS_SCALE,
  PROFILE_STRENGTH_MAX,
  PUSH_NEGLECT_MULT,
  SHARE_WINDOW_DAYS
} from '../constants/catalog-tuning'
import type { Session } from '../types/session'
import type { AppSettings, ExercisePickerMode } from '../types/settings'
import type {
  ExerciseOverride,
  ExerciseV2,
  ExerciseV2Resolved,
  FocusV2,
  Method,
  Zone
} from '../types/exercise-v2'
import { intensityCap } from './dose'
import { dominantZone } from './exercise-v2'
import { effectiveFocus, emptyFocusV2 } from './focus-v2'
import { nowDate } from './clock'

const DAY_MS = 86_400_000
const ROTATION_ORDER: Zone[] = ['upper', 'lower', 'core', 'full']

export interface PickInput {
  catalog: readonly ExerciseV2Resolved[]
  recentSessions: readonly Session[]
  settings: AppSettings
  focus?: FocusV2
  profileStrength?: number
  overrides?: Readonly<Record<string, ExerciseOverride>>
  /** When true, use share-based profile boost (Wave 7 / §4.3 step 2). */
  useShareProfile?: boolean
  now?: Date
  /** Quiet / noSweat context preferences; omitted = no filter. */
  contextPrefs?: { quiet?: boolean; noSweat?: boolean }
  limitations?: readonly string[]
}

export type FilterReason = 'inventory' | 'intensityCap' | 'avoidIf' | 'context' | 'archived'

export interface PickFactor {
  key: 'prev' | 'today' | 'method' | 'neglect' | 'profile' | 'mode'
  mult: number
  note: string
}

export interface PickCandidate {
  id: string
  weight: number
  probability: number
  filteredBy?: FilterReason
  factors: PickFactor[]
}

export interface PickExplanation {
  chosenId: string
  seed: number
  nextRotationZone?: Zone
  candidates: PickCandidate[]
}

export interface PickTrace {
  seed: number
  factors: PickFactor[]
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function overlap(
  a: Partial<Record<Zone, number>>,
  b: Partial<Record<Zone, number>>
): number {
  let sum = 0
  for (const zone of ZONES) sum += Math.min(a[zone] ?? 0, b[zone] ?? 0)
  return Math.min(1, Math.max(0, sum))
}

function doneSessions(sessions: readonly Session[]): { session: Session; at: number }[] {
  const done: { session: Session; at: number }[] = []
  for (const session of sessions) {
    if (session.status !== 'done') continue
    const at = Date.parse(session.completedAt ?? session.triggeredAt)
    if (Number.isNaN(at)) continue
    done.push({ session, at })
  }
  return done.sort((a, b) => a.at - b.at)
}

function zoneVector(exercise: ExerciseV2): Partial<Record<Zone, number>> {
  return exercise.zones
}

function clipLoad(load: Partial<Record<Zone, number>>): Partial<Record<Zone, number>> {
  const out: Partial<Record<Zone, number>> = {}
  for (const zone of ZONES) {
    const value = load[zone]
    if (value && value > 0) out[zone] = Math.min(1, value)
  }
  return out
}

interface Scene {
  now: number
  lastDone: ExerciseV2Resolved | null
  lastMethod: Method | null
  loadToday: Partial<Record<Zone, number>>
  lastZoneAt: Map<Zone, number>
  shareActual: Record<Zone, number>
  shareMethodActual: Record<Method, number>
  /** Done-session count; drives rotation soft-slot (level −) parity. */
  doneCount: number
}

function buildScene(
  catalogById: Map<string, ExerciseV2Resolved>,
  sessions: readonly Session[],
  now: number
): Scene {
  const today = new Date(now)
  const loadToday: Partial<Record<Zone, number>> = {}
  const lastZoneAt = new Map<Zone, number>()
  let lastDone: ExerciseV2Resolved | null = null
  let lastAt = Number.NEGATIVE_INFINITY

  const windowStart = now - SHARE_WINDOW_DAYS * DAY_MS
  const zoneCounts: Record<Zone, number> = { upper: 0, core: 0, lower: 0, full: 0 }
  const methodCounts: Record<Method, number> = {
    mobility: 0,
    strength: 0,
    cardio: 0,
    striking: 0,
    balance: 0
  }
  let shareTotal = 0
  let doneCount = 0

  for (const { session, at } of doneSessions(sessions)) {
    const exercise = catalogById.get(session.exerciseId)
    if (!exercise) continue
    doneCount += 1
    if (at > lastAt) {
      lastAt = at
      lastDone = exercise
    }
    const sameDay =
      new Date(at).getFullYear() === today.getFullYear() &&
      new Date(at).getMonth() === today.getMonth() &&
      new Date(at).getDate() === today.getDate()
    if (sameDay) {
      for (const zone of ZONES) {
        loadToday[zone] = (loadToday[zone] ?? 0) + (exercise.zones[zone] ?? 0)
      }
    }
    const zone = exercise.dominantZone
    lastZoneAt.set(zone, Math.max(lastZoneAt.get(zone) ?? at, at))
    if (at >= windowStart) {
      zoneCounts[zone] += 1
      methodCounts[exercise.method] += 1
      shareTotal += 1
    }
  }

  const shareActual: Record<Zone, number> = { upper: 0, core: 0, lower: 0, full: 0 }
  const shareMethodActual: Record<Method, number> = {
    mobility: 0,
    strength: 0,
    cardio: 0,
    striking: 0,
    balance: 0
  }
  if (shareTotal > 0) {
    for (const zone of ZONES) shareActual[zone] = zoneCounts[zone] / shareTotal
    for (const method of Object.keys(methodCounts) as Method[]) {
      shareMethodActual[method] = methodCounts[method] / shareTotal
    }
  }

  return {
    now,
    lastDone,
    lastMethod: lastDone?.method ?? null,
    loadToday: clipLoad(loadToday),
    lastZoneAt,
    shareActual,
    shareMethodActual,
    doneCount
  }
}

function neglectZone(zone: Zone, scene: Scene): number {
  const last = scene.lastZoneAt.get(zone)
  const days = last === undefined ? NEGLECT_DAYS : (scene.now - last) / DAY_MS
  const ratio = Math.min(Math.max(days, 0), NEGLECT_DAYS) / NEGLECT_DAYS
  return 1 + ratio * (NEGLECT_CAP - 1)
}

function levelBoost(level: -1 | 0 | 1 | 2): number {
  return LEVEL_MULT[level]
}

function profileBoostStep1(exercise: ExerciseV2, focus: FocusV2): number {
  let zoneBoost = 0
  for (const zone of ZONES) {
    zoneBoost += (exercise.zones[zone] ?? 0) * levelBoost(focus.zones[zone])
  }
  if (zoneBoost <= 0) zoneBoost = 1
  const methodBoost = levelBoost(focus.methods[exercise.method])
  return zoneBoost * methodBoost
}

function shareBoost(
  key: string,
  targetShare: number,
  actualShare: number
): number {
  void key
  const actual = Math.max(actualShare, 0.02)
  const ratio = targetShare / actual
  return Math.min(BOOST_CLAMP_MAX, Math.max(BOOST_CLAMP_MIN, Math.sqrt(ratio)))
}

function profileBoostStep2(exercise: ExerciseV2, focus: FocusV2, scene: Scene): number {
  const zoneTargets = targetShares(focus.zones)
  const methodTargets = targetShares(focus.methods)
  let zoneBoost = 0
  for (const zone of ZONES) {
    const share = exercise.zones[zone] ?? 0
    if (share <= 0) continue
    zoneBoost +=
      share *
      shareBoost(zone, zoneTargets[zone] ?? 0, scene.shareActual[zone] ?? 0)
  }
  if (zoneBoost <= 0) zoneBoost = 1
  const methodBoost = shareBoost(
    exercise.method,
    methodTargets[exercise.method] ?? 0,
    scene.shareMethodActual[exercise.method] ?? 0
  )
  return zoneBoost * methodBoost
}

function targetShares<K extends string>(levels: Record<K, -1 | 0 | 1 | 2>): Record<K, number> {
  const keys = Object.keys(levels) as K[]
  let sum = 0
  const raw: Record<string, number> = {}
  for (const key of keys) {
    const value = levelBoost(levels[key])
    raw[key] = value
    sum += value
  }
  const out = {} as Record<K, number>
  for (const key of keys) out[key] = sum > 0 ? raw[key]! / sum : 1 / keys.length
  return out
}

function effectiveLambda(settings: AppSettings, profileStrength: number): number {
  const base = Math.min(1, Math.max(0, profileStrength))
  const scaled =
    settings.pickerMode === 'focus' ? base * PROFILE_STRENGTH_FOCUS_SCALE : base
  return Math.min(PROFILE_STRENGTH_MAX, scaled)
}

function hardFilter(
  exercise: ExerciseV2Resolved,
  input: PickInput
): FilterReason | null {
  if (exercise.status !== 'active') return 'archived'
  const equipment = exercise.equipment
  if (equipment && equipment.length > 0) {
    if (!input.settings.inventory.enabled) return 'inventory'
    if (!equipment.every((item) => input.settings.inventory.items.includes(item))) {
      return 'inventory'
    }
  }
  if (exercise.intensity > intensityCap(input.settings.intervalMinutes)) return 'intensityCap'
  const avoid = exercise.avoidIf ?? []
  const limitations = input.limitations ?? input.settings.limitations ?? []
  if (avoid.some((tag) => limitations.includes(tag))) return 'avoidIf'
  if (input.contextPrefs) {
    if (input.contextPrefs.quiet === true && !exercise.context.quiet) return 'context'
    if (input.contextPrefs.noSweat === true && !exercise.context.noSweat) return 'context'
  }
  return null
}

/**
 * Rotation slots (§4.5): ++ → two slots, 0/+ → one, − → one slot every second cycle.
 * `cycleIndex` is derived from done-session count / base cycle length.
 */
function rotationSlots(focus: FocusV2, cycleIndex: number): Zone[] {
  const slots: Zone[] = []
  const includeSoft = cycleIndex % 2 === 1
  for (const zone of ROTATION_ORDER) {
    const level = focus.zones[zone]
    if (level === 2) {
      slots.push(zone, zone)
    } else if (level === -1) {
      if (includeSoft) slots.push(zone)
    } else {
      slots.push(zone)
    }
  }
  return slots
}

function baseRotationLength(focus: FocusV2): number {
  let length = 0
  for (const zone of ROTATION_ORDER) {
    const level = focus.zones[zone]
    if (level === 2) length += 2
    else length += 1
  }
  return Math.max(1, length)
}

function nextRotationZone(
  scene: Scene,
  focus: FocusV2,
  eligible: readonly ExerciseV2Resolved[]
): Zone | null {
  const cycleIndex = Math.floor(scene.doneCount / baseRotationLength(focus))
  const slots = rotationSlots(focus, cycleIndex)
  if (slots.length === 0) return null
  const lastZone = scene.lastDone?.dominantZone
  let start = 0
  if (lastZone) {
    const idx = slots.findIndex((zone) => zone === lastZone)
    start = idx >= 0 ? (idx + 1) % slots.length : 0
  }
  for (let i = 0; i < slots.length; i++) {
    const zone = slots[(start + i) % slots.length]!
    if (eligible.some((exercise) => exercise.dominantZone === zone)) return zone
  }
  return null
}

function mostNeglectedZone(scene: Scene): Zone {
  let best: Zone = 'upper'
  let bestScore = -1
  for (const zone of ZONES) {
    const score = neglectZone(zone, scene)
    if (score > bestScore) {
      bestScore = score
      best = zone
    }
  }
  return best
}

function weighOne(
  exercise: ExerciseV2Resolved,
  scene: Scene,
  input: PickInput,
  focus: FocusV2,
  mode: ExercisePickerMode,
  rotationZone: Zone | null,
  pushZone: Zone
): { weight: number; factors: PickFactor[] } {
  const factors: PickFactor[] = []
  let weight = 1

  const prev =
    scene.lastDone != null
      ? 1 - OVERLAP_PREV_WEIGHT * overlap(zoneVector(exercise), zoneVector(scene.lastDone))
      : 1
  factors.push({ key: 'prev', mult: prev, note: 'overlap with last done' })
  weight *= prev

  const today = 1 - OVERLAP_TODAY_WEIGHT * overlap(zoneVector(exercise), scene.loadToday)
  factors.push({ key: 'today', mult: today, note: 'overlap with today load' })
  weight *= today

  const methodRepeat =
    scene.lastMethod && scene.lastMethod === exercise.method ? METHOD_REPEAT_MULT : 1
  factors.push({
    key: 'method',
    mult: methodRepeat,
    note: methodRepeat < 1 ? 'same method as last' : 'method ok'
  })
  weight *= methodRepeat

  let neglect = 0
  for (const zone of ZONES) {
    neglect += (exercise.zones[zone] ?? 0) * neglectZone(zone, scene)
  }
  if (neglect <= 0) neglect = 1
  factors.push({ key: 'neglect', mult: neglect, note: 'zone neglect' })
  weight *= neglect

  const boost = input.useShareProfile
    ? profileBoostStep2(exercise, focus, scene)
    : profileBoostStep1(exercise, focus)
  const lambda = effectiveLambda(input.settings, input.profileStrength ?? PROFILE_STRENGTH_DEFAULT)
  const profile = 1 + lambda * (boost - 1)
  factors.push({ key: 'profile', mult: profile, note: `λ=${lambda.toFixed(2)}` })
  weight *= profile

  let modeMult = 1
  let modeNote = 'balance'
  if (mode === 'rotation' && rotationZone) {
    modeMult = exercise.dominantZone === rotationZone ? 1 : 0
    modeNote = `rotation→${rotationZone}`
  } else if (mode === 'push') {
    modeMult =
      (exercise.zones[pushZone] ?? 0) > 0.2 ? PUSH_NEGLECT_MULT : 1 / PUSH_NEGLECT_MULT
    modeNote = `push ${pushZone}`
  } else if (mode === 'focus') {
    modeNote = 'focus λ×1.5'
  }
  factors.push({ key: 'mode', mult: modeMult, note: modeNote })
  weight *= modeMult

  return { weight, factors }
}

function explainFromSeed(input: PickInput, seed: number): PickExplanation {
  const now = (input.now ?? nowDate()).getTime()
  const catalogById = new Map(input.catalog.map((exercise) => [exercise.id, exercise]))
  const scene = buildScene(catalogById, input.recentSessions, now)
  const focus = effectiveFocus(input.focus ?? emptyFocusV2(), input.settings.profileShifts ?? [])
  const random = mulberry32(seed)

  const candidates: PickCandidate[] = []
  const eligible: ExerciseV2Resolved[] = []

  for (const exercise of input.catalog) {
    const filteredBy = hardFilter(exercise, input)
    if (filteredBy) {
      candidates.push({
        id: exercise.id,
        weight: 0,
        probability: 0,
        filteredBy,
        factors: []
      })
      continue
    }
    eligible.push(exercise)
  }

  const mode = input.settings.pickerMode
  const rotationZone =
    mode === 'rotation' ? nextRotationZone(scene, focus, eligible) : null
  const pushZone = mostNeglectedZone(scene)

  let pool = eligible
  if (mode === 'rotation' && rotationZone) {
    const narrowed = eligible.filter((exercise) => exercise.dominantZone === rotationZone)
    if (narrowed.length > 0) pool = narrowed
  }

  const scored: { exercise: ExerciseV2Resolved; weight: number; factors: PickFactor[] }[] = []
  for (const exercise of pool) {
    const { weight, factors } = weighOne(
      exercise,
      scene,
      input,
      focus,
      mode,
      rotationZone,
      pushZone
    )
    scored.push({ exercise, weight, factors })
  }

  const total = scored.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  let chosenId = scored[0]?.exercise.id ?? input.catalog[0]?.id ?? ''
  if (total > 0 && scored.length > 0) {
    let roll = random() * total
    for (const item of scored) {
      roll -= Math.max(0, item.weight)
      if (roll < 0) {
        chosenId = item.exercise.id
        break
      }
      chosenId = item.exercise.id
    }
  }

  for (const item of scored) {
    candidates.push({
      id: item.exercise.id,
      weight: item.weight,
      probability: total > 0 ? item.weight / total : 0,
      factors: item.factors
    })
  }

  // Eligible filtered out of rotation pool still appear with weight 0 for transparency
  for (const exercise of eligible) {
    if (scored.some((item) => item.exercise.id === exercise.id)) continue
    candidates.push({
      id: exercise.id,
      weight: 0,
      probability: 0,
      factors: [{ key: 'mode', mult: 0, note: 'outside rotation zone' }]
    })
  }

  return {
    chosenId,
    seed,
    ...(rotationZone ? { nextRotationZone: rotationZone } : {}),
    candidates
  }
}

export function explainPick(input: PickInput, seed: number): PickExplanation {
  return explainFromSeed(input, seed >>> 0)
}

export function pickExercise(input: PickInput, seed: number): ExerciseV2Resolved {
  const explanation = explainPick(input, seed)
  const chosenMeta = explanation.candidates.find((candidate) => candidate.id === explanation.chosenId)
  if (chosenMeta && !chosenMeta.filteredBy) {
    const found = input.catalog.find((exercise) => exercise.id === explanation.chosenId)
    if (found) return found
  }
  const fallback = input.catalog.find((exercise) => hardFilter(exercise, input) === null)
  if (fallback) return fallback
  // Caller (adapter) maps empty eligibility to FALLBACK_EXERCISE.
  return input.catalog[0]!
}

export function compactPickTrace(explanation: PickExplanation): PickTrace {
  const chosen = explanation.candidates.find((c) => c.id === explanation.chosenId)
  return { seed: explanation.seed, factors: chosen?.factors ?? [] }
}

export { targetShares, profileBoostStep1, profileBoostStep2, nextRotationZone, ROTATION_ORDER }
