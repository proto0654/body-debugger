import type { Session } from '../types/session'
import type { WeightEntry } from '../types/weight'
import { parseFiniteNumber } from './parse-number'

/**
 * Weight history rules (CONCEPT.md §10).
 *
 * Main is the source of truth: a measurement is accepted either with a completed
 * session or as a manual dashboard entry. Anything outside the documented range
 * is dropped instead of clamped, so a bad payload never writes a misleading
 * number. The core cycle keeps working with an empty history.
 */

export const WEIGHT_KG_RANGE = { min: 20, max: 300 } as const

/** Window the dashboard chart and the "change" figure use. */
export const WEIGHT_HISTORY_DAYS = 90

const DAY_MS = 86_400_000

export interface WeightEntryInput {
  weightKg?: unknown
  at?: unknown
  sessionId?: unknown
}

export interface NormalizedWeightEntry {
  at: string
  weightKg: number
  sessionId?: string
}

export interface WeightPoint {
  /** Epoch ms, so the chart never re-parses strings */
  at: number
  weightKg: number
}

/** Weight is stored with one decimal, matching the input step. */
export function roundWeightKg(value: number): number {
  return Math.round(value * 10) / 10
}

function isWithinRange(value: number): boolean {
  return value >= WEIGHT_KG_RANGE.min && value <= WEIGHT_KG_RANGE.max
}

/** Missing timestamps default to `now`; malformed ones are rejected. */
function toIsoTimestamp(value: unknown, now: Date): string | null {
  if (value === undefined || value === null || value === '') return now.toISOString()
  if (typeof value !== 'string') return null

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

/** Valid target weight; null when unset, out of range or malformed. */
export function normalizeWeightTarget(value: unknown): number | null {
  const target = parseFiniteNumber(value)
  if (target === null || !isWithinRange(target)) return null
  return roundWeightKg(target)
}

/** Returns null when any required field is unusable. */
export function normalizeWeightEntry(
  input: WeightEntryInput,
  now: Date = new Date()
): NormalizedWeightEntry | null {
  const weightKg = parseFiniteNumber(input.weightKg)
  if (weightKg === null || !isWithinRange(weightKg)) return null

  const at = toIsoTimestamp(input.at, now)
  if (at === null) return null

  const entry: NormalizedWeightEntry = { at, weightKg: roundWeightKg(weightKg) }
  if (typeof input.sessionId === 'string' && input.sessionId.trim() !== '') {
    entry.sessionId = input.sessionId.trim()
  }
  return entry
}

/** Deterministic id, so a replayed session result cannot duplicate history. */
export function weightEntryIdForSession(sessionId: string): string {
  return `weight:session:${sessionId}`
}

/** A measurement carried by a completed session, if it has a usable weight. */
export function weightEntryFromSession(session: Session): WeightEntry | null {
  if (session.status !== 'done' || typeof session.weightKg !== 'number') return null

  const normalized = normalizeWeightEntry({
    weightKg: session.weightKg,
    at: session.completedAt ?? session.triggeredAt,
    sessionId: session.id
  })
  if (!normalized) return null

  return { id: weightEntryIdForSession(session.id), ...normalized }
}

/**
 * Adds measurements from stored sessions that predate the weight layer.
 * Idempotent: entries already present are skipped by id.
 */
export function mergeSessionWeights(
  sessions: readonly Session[],
  entries: readonly WeightEntry[]
): WeightEntry[] {
  const known = new Set(entries.map((entry) => entry.id))
  const backfilled: WeightEntry[] = []

  for (const session of sessions) {
    const entry = weightEntryFromSession(session)
    if (!entry || known.has(entry.id)) continue
    known.add(entry.id)
    backfilled.push(entry)
  }

  return backfilled.length === 0 ? [...entries] : [...entries, ...backfilled]
}

/** Newest measurement across all history, regardless of the chart window. */
export function latestWeightEntry(entries: readonly WeightEntry[]): WeightEntry | null {
  let latest: WeightEntry | null = null
  for (const entry of entries) {
    if (!Number.isFinite(Date.parse(entry.at))) continue
    if (!latest || Date.parse(entry.at) > Date.parse(latest.at)) latest = entry
  }
  return latest
}

/** Ascending points inside the window; malformed timestamps are skipped. */
export function weightSeries(
  entries: readonly WeightEntry[],
  options: { now: Date; days?: number }
): WeightPoint[] {
  const days = options.days ?? WEIGHT_HISTORY_DAYS
  const from = options.now.getTime() - days * DAY_MS

  return entries
    .map((entry) => ({ at: Date.parse(entry.at), weightKg: entry.weightKg }))
    .filter((point) => Number.isFinite(point.at) && point.at >= from)
    .sort((left, right) => left.at - right.at)
}

/** Latest minus earliest point in the series; null with fewer than two points. */
export function weightChangeKg(series: readonly WeightPoint[]): number | null {
  if (series.length < 2) return null
  const first = series[0]
  const last = series[series.length - 1]
  return roundWeightKg(last.weightKg - first.weightKg)
}

/** Positive = above the goal, negative = below, 0 = exactly on it. */
export function weightTargetGapKg(latestKg: number, targetKg: number): number {
  return roundWeightKg(latestKg - targetKg)
}
