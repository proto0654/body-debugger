import { SESSION_STATUS_LABELS } from '../constants/session'
import { EXERCISE_CATALOG } from '../constants/exercises'
import type { CharacterBranch, CharacterConditionLevel, CharacterStage } from '../types/character'
import type { Exercise } from '../types/exercise'
import type { Session } from '../types/session'
import type { AppSettings } from '../types/settings'
import type { UserProgress } from '../types/progress'
import { advanceCharacterCondition, characterConditionLevel } from './character-condition'
import { characterStageFor, computeCharacterProgress } from './character-progress'
import {
  describeSummaryChange,
  summarizeSessions,
  type SessionSummary
} from './character-summary'
import { labActions } from './laboratory-playback'
import type { LabPlan } from './laboratory'
import { localDateKey } from './stats'

/**
 * Read-only timeline over the real session history (dashboard «Хроника»).
 *
 * The laboratory replays a synthetic plan; this module reconstructs the real
 * history as a chronological set of entries, reusing the same character,
 * condition and streak rules. It never persists or mutates anything.
 */

export type ChronicleEntryKind = 'start' | 'session' | 'now'

export interface ChronicleEntry {
  kind: ChronicleEntryKind
  /** ISO timestamp of the entry; the start entry sits 1 ms before the first session. */
  at: string
  label: string
  session?: Session
  /** Number of normalized history sessions included at this position. */
  sessionCount: number
  stage: CharacterStage
  branch: CharacterBranch
  conditionLevel: CharacterConditionLevel
  milestone: boolean
}

export interface Chronicle {
  /** Normalized chronological, de-duplicated history used by every cursor. */
  sessions: Session[]
  entries: ChronicleEntry[]
  milestoneIndexes: number[]
  /** ISO timestamp of the first included session, null when the history is empty. */
  firstAt: string | null
}

interface TimedSession {
  session: Session
  at: number
}

function sessionTime(session: Session): number | null {
  const at = Date.parse(session.completedAt ?? session.triggeredAt)
  return Number.isFinite(at) ? at : null
}

function localDayIndex(ms: number): number {
  const date = new Date(ms)
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

function normalize(sessions: readonly Session[]): TimedSession[] {
  const timed: TimedSession[] = []
  for (const session of sessions) {
    const at = sessionTime(session)
    if (at !== null) timed.push({ session, at })
  }
  timed.sort((a, b) => a.at - b.at || a.session.id.localeCompare(b.session.id))
  const seen = new Set<string>()
  return timed.filter(({ session }) => {
    if (seen.has(session.id)) return false
    seen.add(session.id)
    return true
  })
}

function titleOf(catalogById: Map<string, Exercise>, exerciseId: string): string {
  return catalogById.get(exerciseId)?.title ?? exerciseId
}

export function buildChronicle(
  sessions: readonly Session[],
  options: { now: Date; catalog?: readonly Exercise[] }
): Chronicle {
  const timed = normalize(sessions)
  if (timed.length === 0) {
    return { sessions: [], entries: [], milestoneIndexes: [], firstAt: null }
  }

  const normalized = timed.map(({ session }) => session)
  const catalogById = new Map((options.catalog ?? EXERCISE_CATALOG).map((exercise) => [exercise.id, exercise]))
  const firstAt = new Date(timed[0]!.at)

  const entries: ChronicleEntry[] = []
  let done = 0
  let processed = 0
  let conditionPoints = 0
  let recentDone: Session[] = []
  let lastDoneDay: number | null = null
  let breakShown = false
  let previousStage: CharacterStage = 0
  let previousBranch: CharacterBranch = 'neutral'
  let previousLevel: CharacterConditionLevel = 0

  entries.push({
    kind: 'start',
    at: new Date(firstAt.getTime() - 1).toISOString(),
    label: 'Начало истории',
    sessionCount: 0,
    stage: 0,
    branch: 'neutral',
    conditionLevel: 0,
    milestone: false
  })

  for (const { session, at } of timed) {
    const day = localDayIndex(at)
    let streakBreak = false
    if (lastDoneDay !== null && day - lastDoneDay > 1 && !breakShown) {
      streakBreak = true
      breakShown = true
    }

    conditionPoints = advanceCharacterCondition(conditionPoints, session.status)
    if (session.status === 'done') {
      done += 1
      recentDone.push(session)
      if (recentDone.length > 30) recentDone = recentDone.slice(1)
      lastDoneDay = day
      breakShown = false
    }

    const stage = characterStageFor(done)
    const branch: CharacterBranch = recentDone.length > 0 ? computeCharacterProgress(recentDone).branch : 'neutral'
    const conditionLevel = characterConditionLevel(conditionPoints)
    const milestone = streakBreak || stage !== previousStage || branch !== previousBranch || conditionLevel !== previousLevel
    processed += 1

    entries.push({
      kind: 'session',
      at: new Date(at).toISOString(),
      label: `${SESSION_STATUS_LABELS[session.status]} · ${titleOf(catalogById, session.exerciseId)}`,
      session,
      sessionCount: processed,
      stage,
      branch,
      conditionLevel,
      milestone
    })

    previousStage = stage
    previousBranch = branch
    previousLevel = conditionLevel
  }

  const lastEntry = entries[entries.length - 1]!
  const nowMs = options.now.getTime()
  const lastAt = Date.parse(lastEntry.at)
  if (nowMs > lastAt) {
    const nowDay = localDayIndex(nowMs)
    const streakBreak = lastDoneDay !== null && nowDay - lastDoneDay > 1 && !breakShown
    entries.push({
      kind: 'now',
      at: new Date(nowMs).toISOString(),
      label: 'Сейчас',
      sessionCount: normalized.length,
      stage: lastEntry.stage,
      branch: lastEntry.branch,
      conditionLevel: lastEntry.conditionLevel,
      milestone: streakBreak
    })
  }

  const milestoneIndexes = entries
    .map((entry, index) => (entry.milestone ? index : -1))
    .filter((index) => index >= 0)
  milestoneIndexes.push(0, entries.length - 1)
  const uniqueMilestones = Array.from(new Set(milestoneIndexes)).sort((a, b) => a - b)

  return { sessions: normalized, entries, milestoneIndexes: uniqueMilestones, firstAt: firstAt.toISOString() }
}

export function chronicleSummary(chronicle: Chronicle, cursor: number): SessionSummary | null {
  const entry = chronicle.entries[cursor]
  if (!entry) return null
  return summarizeSessions(chronicle.sessions.slice(0, entry.sessionCount), new Date(entry.at))
}

export function chroniclePrefix(chronicle: Chronicle, cursor: number): Session[] {
  const entry = chronicle.entries[cursor]
  return entry ? chronicle.sessions.slice(0, entry.sessionCount) : []
}

export function chronicleExplanation(chronicle: Chronicle, cursor: number): string {
  const entry = chronicle.entries[cursor]
  if (!entry) return ''
  if (entry.kind === 'start') {
    return 'Начальное состояние. Будущие события не участвуют в расчётах.'
  }
  const before = chronicleSummary(chronicle, cursor - 1)
  const after = chronicleSummary(chronicle, cursor)
  if (!before || !after) return ''
  return describeSummaryChange(before, after, entry.session)
}

/** Index of the last entry at or before the end of a local calendar date. */
export function chronicleDateIndex(chronicle: Chronicle, date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const at = new Date(`${date}T23:59:59.999`).getTime()
  if (!Number.isFinite(at) || localDateKey(new Date(at)) !== date) return null
  let result = 0
  for (let index = 0; index < chronicle.entries.length; index += 1) {
    if (Date.parse(chronicle.entries[index]!.at) > at) break
    result = index
  }
  return result
}

/** Feed the shared NativePlayback engine from real history without mutating it. */
export function chronicleToLabPlan(
  sessions: readonly Session[],
  settings: AppSettings,
  progress: UserProgress,
  now: Date,
  catalog?: readonly Exercise[]
): LabPlan {
  const chronicle = buildChronicle(sessions, { now, catalog })
  return {
    version: 2,
    id: 'chronicle-history',
    title: 'Хроника',
    settings,
    progress,
    events: chronicle.entries.map((entry) => ({
      at: entry.at,
      label: entry.label,
      ...(entry.session
        ? { session: { ...entry.session }, actions: labActions(entry.session) }
        : {})
    }))
  }
}
