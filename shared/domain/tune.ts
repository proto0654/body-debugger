import {
  HINT_COOLDOWN_SHOWS,
  HINT_SKIP_THRESHOLD,
  HINT_WINDOW,
  PERSONAL_SCALE_STEP,
  SCALE_HISTORY_LIMIT,
  SHARE_WINDOW_DAYS,
  TUNE_LONG_WINDOW_DAYS
} from '../constants/catalog-tuning'
import type {
  ExerciseOverride,
  ExerciseV2Resolved,
  FocusV2,
  ScaleHistoryEntry
} from '../types/exercise-v2'
import type { AppSettings } from '../types/settings'
import type { Session } from '../types/session'
import { characterStageFor } from './character-progress'
import { dose } from './dose'
import { targetVsActual } from './coverage'

export type ExerciseHintKind = 'ready_to_progress' | 'often_skipped'

export interface ExerciseHint {
  exerciseId: string
  kind: ExerciseHintKind
  suggestedScale: number
}

export interface TuneAggregates {
  windows: {
    shortDays: number
    longDays: number
    zonesShort: { key: string; doneShare: number; skipShare: number }[]
    methodsShort: { key: string; doneShare: number; skipShare: number }[]
    zonesLong: { key: string; doneShare: number; skipShare: number }[]
    methodsLong: { key: string; doneShare: number; skipShare: number }[]
  }
  topSkipped: { id: string; skips: number }[]
  doseVsRange: { id: string; planned: number; min: number; max: number; scale: number }[]
  stage: number
  intervalMinutes: number
  focus: FocusV2
  profileStrength: number
  hints: ExerciseHint[]
}

/**
 * Derive per-exercise hints from recent shows (CATALOG-V2 §9.1).
 * `snoozed` is ignored; `skipped` and `missed` count as skips.
 */
export function exerciseHints(
  sessions: readonly Session[],
  catalog: readonly ExerciseV2Resolved[],
  scales: Readonly<Record<string, number>> = {},
  cooldownIds: ReadonlySet<string> = new Set()
): ExerciseHint[] {
  const byExercise = new Map<string, Session[]>()
  for (const session of sessions) {
    if (session.status === 'snoozed') continue
    const list = byExercise.get(session.exerciseId) ?? []
    list.push(session)
    byExercise.set(session.exerciseId, list)
  }

  const hints: ExerciseHint[] = []
  for (const exercise of catalog) {
    if (cooldownIds.has(exercise.id)) continue
    const shows = (byExercise.get(exercise.id) ?? [])
      .slice()
      .sort((a, b) => {
        const aAt = Date.parse(a.completedAt ?? a.triggeredAt)
        const bAt = Date.parse(b.completedAt ?? b.triggeredAt)
        return (Number.isNaN(aAt) ? 0 : aAt) - (Number.isNaN(bAt) ? 0 : bAt)
      })
      .slice(-HINT_WINDOW)
    if (shows.length < HINT_WINDOW) continue

    const currentScale = scales[exercise.id] ?? 1
    const allDone = shows.every((session) => session.status === 'done')
    const skips = shows.filter(
      (session) => session.status === 'skipped' || session.status === 'missed'
    ).length

    if (allDone) {
      hints.push({
        exerciseId: exercise.id,
        kind: 'ready_to_progress',
        suggestedScale: Number((currentScale * (1 + PERSONAL_SCALE_STEP)).toFixed(2))
      })
    } else if (skips >= HINT_SKIP_THRESHOLD) {
      hints.push({
        exerciseId: exercise.id,
        kind: 'often_skipped',
        suggestedScale: Number((currentScale * (1 - PERSONAL_SCALE_STEP)).toFixed(2))
      })
    }
  }
  return hints
}

/** Exercise ids still inside the post-scale cooldown window (§9.1). */
export function cooldownExerciseIds(
  sessions: readonly Session[],
  overrides: Readonly<Record<string, ExerciseOverride>>,
  now = Date.now()
): Set<string> {
  const cooling = new Set<string>()
  for (const [id, override] of Object.entries(overrides)) {
    if (!override.scaledAt) continue
    const since = Date.parse(override.scaledAt)
    if (Number.isNaN(since)) continue
    const showsAfter = sessions.filter((session) => {
      if (session.exerciseId !== id || session.status === 'snoozed') return false
      const at = Date.parse(session.completedAt ?? session.triggeredAt)
      return !Number.isNaN(at) && at > since && at <= now
    }).length
    if (showsAfter < HINT_COOLDOWN_SHOWS) cooling.add(id)
  }
  return cooling
}

export function applyScaleChange(
  overrides: Readonly<Record<string, ExerciseOverride>>,
  history: readonly ScaleHistoryEntry[],
  exerciseId: string,
  nextScale: number,
  source: ScaleHistoryEntry['source'],
  at = new Date().toISOString()
): { overrides: Record<string, ExerciseOverride>; scaleHistory: ScaleHistoryEntry[] } {
  const current = overrides[exerciseId] ?? {}
  const fromScale = current.scale ?? 1
  const toScale = Number(Math.max(0.1, nextScale).toFixed(2))
  if (fromScale === toScale && source !== 'undo') {
    return { overrides: { ...overrides }, scaleHistory: [...history] }
  }
  const nextOverrides: Record<string, ExerciseOverride> = {
    ...overrides,
    [exerciseId]: {
      ...current,
      previousScale: fromScale,
      scale: toScale,
      scaledAt: at
    }
  }
  const entry: ScaleHistoryEntry = {
    exerciseId,
    fromScale,
    toScale,
    at,
    source
  }
  return {
    overrides: nextOverrides,
    scaleHistory: [entry, ...history].slice(0, SCALE_HISTORY_LIMIT)
  }
}

export function undoLastScale(
  overrides: Readonly<Record<string, ExerciseOverride>>,
  history: readonly ScaleHistoryEntry[],
  exerciseId?: string
): { overrides: Record<string, ExerciseOverride>; scaleHistory: ScaleHistoryEntry[] } | null {
  const entry = exerciseId
    ? history.find((item) => item.exerciseId === exerciseId)
    : history[0]
  if (!entry) return null
  const current = overrides[entry.exerciseId]
  const restore = current?.previousScale ?? entry.fromScale
  return applyScaleChange(overrides, history, entry.exerciseId, restore, 'undo')
}

/**
 * Silently apply all current hints (autoTune = auto). Returns null when nothing changes.
 */
export function applyAutoTuneHints(
  sessions: readonly Session[],
  catalog: readonly ExerciseV2Resolved[],
  overrides: Readonly<Record<string, ExerciseOverride>>,
  history: readonly ScaleHistoryEntry[],
  at = new Date().toISOString()
): { overrides: Record<string, ExerciseOverride>; scaleHistory: ScaleHistoryEntry[] } | null {
  const cooling = cooldownExerciseIds(sessions, overrides)
  const scales: Record<string, number> = {}
  for (const [id, override] of Object.entries(overrides)) {
    if (override.scale !== undefined) scales[id] = override.scale
  }
  const hints = exerciseHints(sessions, catalog, scales, cooling)
  if (hints.length === 0) return null

  let nextOverrides = { ...overrides }
  let nextHistory = [...history]
  let changed = false
  for (const hint of hints) {
    const applied = applyScaleChange(
      nextOverrides,
      nextHistory,
      hint.exerciseId,
      hint.suggestedScale,
      'auto',
      at
    )
    nextOverrides = applied.overrides
    nextHistory = applied.scaleHistory
    changed = true
  }
  return changed ? { overrides: nextOverrides, scaleHistory: nextHistory } : null
}

function axisOutcomeShares(
  sessions: readonly Session[],
  catalog: readonly ExerciseV2Resolved[],
  days: number,
  now: number
): {
  zones: { key: string; doneShare: number; skipShare: number }[]
  methods: { key: string; doneShare: number; skipShare: number }[]
} {
  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  const windowStart = now - days * 86_400_000
  const zoneDone: Record<string, number> = { upper: 0, core: 0, lower: 0, full: 0 }
  const zoneSkip: Record<string, number> = { upper: 0, core: 0, lower: 0, full: 0 }
  const methodDone: Record<string, number> = {
    mobility: 0,
    strength: 0,
    cardio: 0,
    striking: 0,
    balance: 0
  }
  const methodSkip: Record<string, number> = {
    mobility: 0,
    strength: 0,
    cardio: 0,
    striking: 0,
    balance: 0
  }
  let doneTotal = 0
  let skipTotal = 0

  for (const session of sessions) {
    if (session.status === 'snoozed') continue
    const at = Date.parse(session.completedAt ?? session.triggeredAt)
    if (Number.isNaN(at) || at < windowStart) continue
    const exercise = catalogById.get(session.exerciseId)
    if (!exercise) continue
    if (session.status === 'done') {
      zoneDone[exercise.dominantZone] = (zoneDone[exercise.dominantZone] ?? 0) + 1
      methodDone[exercise.method] = (methodDone[exercise.method] ?? 0) + 1
      doneTotal += 1
    } else if (session.status === 'skipped' || session.status === 'missed') {
      zoneSkip[exercise.dominantZone] = (zoneSkip[exercise.dominantZone] ?? 0) + 1
      methodSkip[exercise.method] = (methodSkip[exercise.method] ?? 0) + 1
      skipTotal += 1
    }
  }

  const zoneKeys = Object.keys(zoneDone)
  const methodKeys = Object.keys(methodDone)
  return {
    zones: zoneKeys.map((key) => ({
      key,
      doneShare: doneTotal > 0 ? (zoneDone[key] ?? 0) / doneTotal : 0,
      skipShare: skipTotal > 0 ? (zoneSkip[key] ?? 0) / skipTotal : 0
    })),
    methods: methodKeys.map((key) => ({
      key,
      doneShare: doneTotal > 0 ? (methodDone[key] ?? 0) / doneTotal : 0,
      skipShare: skipTotal > 0 ? (methodSkip[key] ?? 0) / skipTotal : 0
    }))
  }
}

/** Aggregates for the optional LLM progress advisor (CATALOG-V2 §9.2). */
export function buildTuneAggregates(
  sessions: readonly Session[],
  catalog: readonly ExerciseV2Resolved[],
  settings: AppSettings,
  hints: readonly ExerciseHint[],
  now = Date.now()
): TuneAggregates {
  const short = axisOutcomeShares(sessions, catalog, SHARE_WINDOW_DAYS, now)
  const long = axisOutcomeShares(sessions, catalog, TUNE_LONG_WINDOW_DAYS, now)

  const skipCounts = new Map<string, number>()
  for (const session of sessions) {
    if (session.status !== 'skipped' && session.status !== 'missed') continue
    skipCounts.set(session.exerciseId, (skipCounts.get(session.exerciseId) ?? 0) + 1)
  }
  const topSkipped = Array.from(skipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, skips]) => ({ id, skips }))

  const doseVsRange = catalog.slice(0, 40).map((exercise) => {
    const scale = settings.overrides[exercise.id]?.scale ?? 1
    return {
      id: exercise.id,
      planned: dose(exercise.timer, settings.intervalMinutes, scale),
      min: exercise.timer.minSec,
      max: exercise.timer.maxSec,
      scale
    }
  })

  const doneCount = sessions.filter((session) => session.status === 'done').length
  // Keep targetVsActual available for consumers that want share bars alongside aggregates.
  void targetVsActual(settings.focusV2, sessions, catalog, now)

  return {
    windows: {
      shortDays: SHARE_WINDOW_DAYS,
      longDays: TUNE_LONG_WINDOW_DAYS,
      zonesShort: short.zones,
      methodsShort: short.methods,
      zonesLong: long.zones,
      methodsLong: long.methods
    },
    topSkipped,
    doseVsRange,
    stage: characterStageFor(doneCount),
    intervalMinutes: settings.intervalMinutes,
    focus: {
      zones: { ...settings.focusV2.zones },
      methods: { ...settings.focusV2.methods }
    },
    profileStrength: settings.profileStrength,
    hints: hints.map((hint) => ({ ...hint }))
  }
}
