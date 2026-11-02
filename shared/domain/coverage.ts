import { METHODS, ZONES } from '../constants/catalog-axes'
import { COVERAGE_THRESHOLD, SHARE_WINDOW_DAYS } from '../constants/catalog-tuning'
import type { ExerciseV2Resolved, FocusV2, Method, Zone } from '../types/exercise-v2'
import type { Session } from '../types/session'
import { LEVEL_MULT } from '../constants/catalog-tuning'

export interface CoverageCell {
  zone: Zone
  method: Method
  count: number
  avgIntensity: number
  belowThreshold: boolean
}

export function coverageMatrix(
  catalog: readonly ExerciseV2Resolved[],
  threshold = COVERAGE_THRESHOLD
): CoverageCell[] {
  const cells: CoverageCell[] = []
  for (const zone of ZONES) {
    for (const method of METHODS) {
      const matches = catalog.filter(
        (exercise) =>
          exercise.status === 'active' &&
          exercise.dominantZone === zone &&
          exercise.method === method
      )
      const avgIntensity =
        matches.length === 0
          ? 0
          : matches.reduce((sum, exercise) => sum + exercise.intensity, 0) / matches.length
      cells.push({
        zone,
        method,
        count: matches.length,
        avgIntensity,
        belowThreshold: matches.length < threshold
      })
    }
  }
  return cells
}

export interface AxisShare {
  key: string
  target: number
  actual: number
}

export function targetVsActual(
  focus: FocusV2,
  sessions: readonly Session[],
  catalog: readonly ExerciseV2Resolved[],
  now = Date.now()
): { zones: AxisShare[]; methods: AxisShare[] } {
  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  const windowStart = now - SHARE_WINDOW_DAYS * 86_400_000
  const zoneCounts: Record<Zone, number> = { upper: 0, core: 0, lower: 0, full: 0 }
  const methodCounts: Record<Method, number> = {
    mobility: 0,
    strength: 0,
    cardio: 0,
    striking: 0,
    balance: 0
  }
  let total = 0

  for (const session of sessions) {
    if (session.status !== 'done') continue
    const at = Date.parse(session.completedAt ?? session.triggeredAt)
    if (Number.isNaN(at) || at < windowStart) continue
    const exercise = catalogById.get(session.exerciseId)
    if (!exercise) continue
    zoneCounts[exercise.dominantZone] += 1
    methodCounts[exercise.method] += 1
    total += 1
  }

  return {
    zones: sharesFor(focus.zones, zoneCounts, total),
    methods: sharesFor(focus.methods, methodCounts, total)
  }
}

function sharesFor<K extends string>(
  levels: Record<K, -1 | 0 | 1 | 2>,
  counts: Record<K, number>,
  total: number
): AxisShare[] {
  const keys = Object.keys(levels) as K[]
  let weightSum = 0
  const weights: Record<string, number> = {}
  for (const key of keys) {
    weights[key] = LEVEL_MULT[levels[key]]
    weightSum += weights[key]!
  }
  return keys.map((key) => ({
    key,
    target: weightSum > 0 ? weights[key]! / weightSum : 1 / keys.length,
    actual: total > 0 ? (counts[key] ?? 0) / total : 0
  }))
}
