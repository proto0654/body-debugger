/** Catalog playground pure helpers (docs/CATALOG-UI.md §6). */

import { METHODS, ZONES } from '../constants/catalog-axes'
import { EFFECTIVE_POOL_WARN_THRESHOLD } from '../constants/field-docs'
import type { FocusLevel, FocusV2, Method, Zone } from '../types/exercise-v2'
import type { Session } from '../types/session'
import { emptyFocusV2 } from './focus-v2'
import {
  explainPick,
  pickExercise,
  type PickCandidate,
  type PickExplanation,
  type PickInput
} from './picker'

export { EFFECTIVE_POOL_WARN_THRESHOLD }

export function effectiveSize(probs: readonly number[]): number {
  let sumSq = 0
  for (const p of probs) {
    if (p > 0) sumSq += p * p
  }
  if (sumSq <= 0) return 0
  return 1 / sumSq
}

export interface PoolSnapshot {
  explanation: PickExplanation
  candidates: PickCandidate[]
  eligibleCount: number
  effectiveSize: number
  topMass: number
  thin: boolean
}

export function poolSnapshot(input: PickInput, seed = 1): PoolSnapshot {
  const explanation = explainPick(input, seed)
  const eligible = explanation.candidates.filter((c) => !c.filteredBy)
  const probs = eligible.map((c) => c.probability)
  const ranked = [...eligible].sort((a, b) => b.probability - a.probability)
  const top3 = ranked.slice(0, 3)
  const topMass = top3.reduce((sum, c) => sum + c.probability, 0)
  const size = effectiveSize(probs)
  return {
    explanation,
    candidates: explanation.candidates,
    eligibleCount: eligible.length,
    effectiveSize: size,
    topMass,
    thin: size > 0 && size < EFFECTIVE_POOL_WARN_THRESHOLD
  }
}

export interface ComboCell {
  zone: Zone
  method: Method
  top3: { id: string; probability: number }[]
  topMass: number
  effectiveSize: number
  eligibleCount: number
  dead: boolean
  thin: boolean
}

function withBoost(focus: FocusV2, zone: Zone, method: Method): FocusV2 {
  return {
    zones: { ...focus.zones, [zone]: 2 as FocusLevel },
    methods: { ...focus.methods, [method]: 2 as FocusLevel }
  }
}

export function comboMatrix(input: PickInput, seed = 1): ComboCell[] {
  const baseFocus = input.focus ?? emptyFocusV2()
  const cells: ComboCell[] = []
  for (const zone of ZONES) {
    for (const method of METHODS) {
      const snap = poolSnapshot({ ...input, focus: withBoost(baseFocus, zone, method) }, seed)
      const eligible = snap.candidates
        .filter((c) => !c.filteredBy)
        .sort((a, b) => b.probability - a.probability)
      const top3 = eligible.slice(0, 3).map((c) => ({ id: c.id, probability: c.probability }))
      cells.push({
        zone,
        method,
        top3,
        topMass: snap.topMass,
        effectiveSize: snap.effectiveSize,
        eligibleCount: snap.eligibleCount,
        dead: snap.eligibleCount === 0,
        thin: snap.thin
      })
    }
  }
  return cells
}

export interface PoolDeltaRow {
  id: string
  before: number
  after: number
  delta: number
  status: 'gained' | 'lost' | 'moved'
}

export interface PreviewDelta {
  gained: PoolDeltaRow[]
  lost: PoolDeltaRow[]
  moved: PoolDeltaRow[]
  /** Top 3 gainers and losers by delta. */
  topGain: PoolDeltaRow[]
  topLose: PoolDeltaRow[]
}

export function previewDelta(before: PickInput, after: PickInput, seed = 1): PreviewDelta {
  const a = poolSnapshot(before, seed)
  const b = poolSnapshot(after, seed)
  const beforeMap = new Map(
    a.candidates.filter((c) => !c.filteredBy).map((c) => [c.id, c.probability])
  )
  const afterMap = new Map(
    b.candidates.filter((c) => !c.filteredBy).map((c) => [c.id, c.probability])
  )
  const gained: PoolDeltaRow[] = []
  const lost: PoolDeltaRow[] = []
  const moved: PoolDeltaRow[] = []
  const ids = new Set([...Array.from(beforeMap.keys()), ...Array.from(afterMap.keys())])
  for (const id of Array.from(ids)) {
    const prev = beforeMap.get(id)
    const next = afterMap.get(id)
    if (prev === undefined && next !== undefined) {
      gained.push({ id, before: 0, after: next, delta: next, status: 'gained' })
    } else if (prev !== undefined && next === undefined) {
      lost.push({ id, before: prev, after: 0, delta: -prev, status: 'lost' })
    } else if (prev !== undefined && next !== undefined && Math.abs(next - prev) > 1e-9) {
      moved.push({ id, before: prev, after: next, delta: next - prev, status: 'moved' })
    }
  }
  const byDelta = [...gained, ...lost, ...moved].sort((x, y) => y.delta - x.delta)
  return {
    gained,
    lost,
    moved,
    topGain: byDelta.filter((r) => r.delta > 0).slice(0, 3),
    topLose: byDelta.filter((r) => r.delta < 0).slice(-3).reverse()
  }
}

export interface SimulateResult {
  n: number
  seed: number
  zoneShares: Record<Zone, number>
  methodShares: Record<Method, number>
  uniqueCount: number
  longestSameZoneStreak: number
  repeatWithin3Rate: number
  histogram: { id: string; count: number; share: number }[]
}

export function simulate(input: PickInput, n: number, seed: number): SimulateResult {
  const runs = Math.max(1, Math.floor(n))
  const counts = new Map<string, number>()
  const zoneShares: Record<Zone, number> = { upper: 0, core: 0, lower: 0, full: 0 }
  const methodShares: Record<Method, number> = {
    mobility: 0,
    strength: 0,
    cardio: 0,
    striking: 0,
    balance: 0
  }
  const sequence: { id: string; zone: Zone }[] = []
  let longest = 0
  let streak = 0
  let lastZone: Zone | null = null
  let repeatWithin3 = 0

  for (let i = 0; i < runs; i++) {
    const picked = pickExercise(input, (seed + i) >>> 0)
    counts.set(picked.id, (counts.get(picked.id) ?? 0) + 1)
    zoneShares[picked.dominantZone] += 1 / runs
    methodShares[picked.method] += 1 / runs
    if (picked.dominantZone === lastZone) {
      streak += 1
    } else {
      streak = 1
      lastZone = picked.dominantZone
    }
    longest = Math.max(longest, streak)
    const window = sequence.slice(-3)
    if (window.some((item) => item.id === picked.id)) repeatWithin3 += 1
    sequence.push({ id: picked.id, zone: picked.dominantZone })
  }

  const histogram = Array.from(counts.entries())
    .map(([id, count]) => ({ id, count, share: count / runs }))
    .sort((a, b) => b.count - a.count)

  return {
    n: runs,
    seed: seed >>> 0,
    zoneShares,
    methodShares,
    uniqueCount: counts.size,
    longestSameZoneStreak: longest,
    repeatWithin3Rate: repeatWithin3 / runs,
    histogram
  }
}

export interface WeekDayStrip {
  day: number
  zones: Zone[]
  exerciseIds: string[]
}

export interface WeekPreview {
  days: WeekDayStrip[]
  heatmap: Record<Zone, number[]>
}

export function simulateWeek(
  input: PickInput,
  days: number,
  perDay: number,
  seed: number
): WeekPreview {
  const dCount = Math.max(1, Math.floor(days))
  const k = Math.max(1, Math.floor(perDay))
  const heatmap: Record<Zone, number[]> = {
    upper: Array.from({ length: dCount }, () => 0),
    core: Array.from({ length: dCount }, () => 0),
    lower: Array.from({ length: dCount }, () => 0),
    full: Array.from({ length: dCount }, () => 0)
  }
  const dayStrips: WeekDayStrip[] = []
  let history = [...input.recentSessions]
  let run = 0

  for (let day = 0; day < dCount; day++) {
    const zones: Zone[] = []
    const exerciseIds: string[] = []
    for (let slot = 0; slot < k; slot++) {
      const picked = pickExercise({ ...input, recentSessions: history }, (seed + run) >>> 0)
      run += 1
      zones.push(picked.dominantZone)
      exerciseIds.push(picked.id)
      heatmap[picked.dominantZone][day] += 1
      const fake: Session = {
        id: `sim-${day}-${slot}`,
        exerciseId: picked.id,
        status: 'done',
        durationSec: 45,
        triggeredAt: new Date(Date.UTC(2020, 0, day + 1, slot)).toISOString(),
        completedAt: new Date(Date.UTC(2020, 0, day + 1, slot, 1)).toISOString()
      }
      history = [...history, fake]
    }
    dayStrips.push({ day, zones, exerciseIds })
  }

  return { days: dayStrips, heatmap }
}
