import { randomUUID } from 'node:crypto'
import { powerMonitor } from 'electron'
import { getAvailableCatalog } from './custom-exercises'
import { pickNextExercise } from '../../shared/domain/exercise-picker'
import { normalizeSessionExtras } from '../../shared/domain/session-extras'
import { normalizePhotoIds } from '../../shared/domain/photos'
import { getPhoto } from './photos'
import {
  IpcChannels,
  type SessionLoopStatePayload,
  type SessionPopupPayload,
  type SessionResultPayload,
  type SessionTriggerPayload,
  type SessionTriggerReason,
  type TrayState
} from '../../shared/types/events'
import type { Exercise } from '../../shared/types/exercise'
import type { Session, SessionExtras, SessionStatus } from '../../shared/types/session'
import { broadcastToWindows, notifyDataUpdated } from './broadcast'
import {
  appendSession,
  applyDoneSession,
  getSettings,
  getSnapshot,
  updateSettings
} from './persistence'
import { closePopupWindow, createPopupWindow, getPopupWindow } from './windows/popup'
import { getTrayState, refreshTrayAnimation, refreshTrayMenu, setTrayPaused, setTrayState } from './tray'

/**
 * Reminder loop (CONCEPT.md §2, ROADMAP #2).
 *
 * - The next trigger counts from the last resolved session (`completedAt`).
 * - Snooze restarts the cycle after a short delay instead of a full interval.
 * - Reminders never fire while the user is away (system idle); an absence long
 *   enough to be a real break restarts the cycle on return.
 * - Pause stops scheduling but keeps manual triggers available.
 * - An unanswered popup becomes `missed`; closing it counts as `skipped`.
 *
 * Main process owns the state; renderers read it through `session:get-loop-state`
 * and the `session:loop-changed` push.
 */

/** How often the loop re-checks the clock and user presence. */
const TICK_MS = 5_000
/** Snooze pushes the next trigger out by this much instead of a full interval. */
const SNOOZE_MINUTES = 5
/** No answer to an open popup for this long → `missed`. */
const MISSED_AFTER_MS = 5 * 60_000
/** User counts as away (no popup) after this much system idle time. */
const AWAY_IDLE_SEC = 60
/** Being away this long already counts as a break: the cycle restarts on return. */
const REST_IDLE_SEC = 5 * 60
/** Grace before the first trigger after launch so the app does not pop up instantly. */
const STARTUP_GRACE_MS = 60_000
/** Minimum delay when the schedule is recomputed after a settings change. */
const RESCHEDULE_GRACE_MS = 15_000

const SESSION_STATUSES: readonly SessionStatus[] = ['done', 'snoozed', 'skipped', 'missed']

interface AwaitingResult {
  sessionId: string
  exercise: Exercise
  triggeredAt: string
  timeout: NodeJS.Timeout
}

/** Identity of a session being resolved — from the open popup or from the renderer. */
interface SessionOrigin {
  sessionId: string
  exerciseId: string
  triggeredAt: string
  durationSec: number
}

type SessionCompletionExtras = SessionExtras & {
  durationSec?: number
  skipReason?: string
}

let started = false
let paused = false
let lastIntervalMinutes: number | null = null
let ticker: NodeJS.Timeout | null = null
let nextTriggerAt: number | null = null
let awayStartedAt: number | null = null
let awaiting: AwaitingResult | null = null

function intervalMs(): number {
  return Math.max(1, Math.round(getSettings().intervalMinutes)) * 60_000
}

/** Completion time of the newest resolved session, if any. */
function lastResolvedAt(): number | null {
  const { sessions } = getSnapshot()
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index]
    const parsed = Date.parse(session.completedAt ?? session.triggeredAt)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

function dueFrom(now: number): number {
  return (lastResolvedAt() ?? now) + intervalMs()
}

function trayStateFor(status: SessionStatus): TrayState {
  if (status === 'done') return 'success'
  if (status === 'snoozed') return 'soon'
  return 'idle'
}

function publishLoopState(): void {
  broadcastToWindows(IpcChannels.SessionLoopChanged, getLoopState())
}

export function getLoopState(): SessionLoopStatePayload {
  return {
    paused,
    nextTriggerAt: nextTriggerAt === null ? null : new Date(nextTriggerAt).toISOString(),
    intervalMinutes: getSettings().intervalMinutes
  }
}

/** The popup currently asking for a result, if any. */
export function getActivePopup(): SessionPopupPayload | null {
  return awaiting ? { sessionId: awaiting.sessionId, exercise: awaiting.exercise } : null
}

/**
 * Resolve the open popup: append the session, refresh tray, and schedule the next trigger.
 * Callers either answered the popup, closed it, or let it time out.
 */
function completeSession(
  origin: SessionOrigin,
  status: SessionStatus,
  extras: SessionCompletionExtras = {}
): void {
  if (awaiting?.sessionId === origin.sessionId) {
    clearTimeout(awaiting.timeout)
    awaiting = null
  }

  // Photos must already exist in the main store; stale or forged ids are dropped.
  const photoIds = normalizePhotoIds(extras.photoIds).filter((id) => getPhoto(id) !== null)
  const session: Session = {
    id: origin.sessionId,
    exerciseId: origin.exerciseId,
    status,
    durationSec: extras.durationSec ?? origin.durationSec,
    triggeredAt: origin.triggeredAt,
    completedAt: new Date().toISOString(),
    // Untrusted renderer input: only in-range details are stored.
    ...normalizeSessionExtras(extras),
    ...(photoIds.length > 0 ? { photoIds } : {})
  }
  if (extras.skipReason) session.skipReason = extras.skipReason

  try {
    appendSession(session)
    if (status === 'done') applyDoneSession()
    notifyDataUpdated()
  } catch (error) {
    // Keep the reminder cycle alive even if the disk write fails.
    console.error('[trigger-loop] failed to persist session', error)
  }

  const trayState = trayStateFor(status)
  setTrayState(trayState)
  broadcastToWindows(IpcChannels.SessionUpdated, { session, trayState })
  if (trayState === 'success') {
    setTimeout(() => {
      if (getTrayState() === 'success') setTrayState('idle')
    }, 1500)
  }

  const now = Date.now()
  awayStartedAt = null
  if (paused) nextTriggerAt = null
  else if (status === 'snoozed') nextTriggerAt = now + SNOOZE_MINUTES * 60_000
  else nextTriggerAt = now + intervalMs()

  publishLoopState()
}

function originOfAwaiting(current: AwaitingResult): SessionOrigin {
  return {
    sessionId: current.sessionId,
    exerciseId: current.exercise.id,
    triggeredAt: current.triggeredAt,
    durationSec: current.exercise.durationSec
  }
}

function validDuration(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Renderer reported a result — the canonical write happens here. */
export function handleSessionResult(payload: SessionResultPayload): void {
  // Untrusted IPC: never write an unknown status or a session without identity.
  if (!payload || !SESSION_STATUSES.includes(payload.status)) {
    console.warn('[session:result] unknown status', payload?.status)
    return
  }
  if (!awaiting && (!payload.sessionId || !payload.exerciseId)) {
    console.warn('[session:result] missing session identity')
    return
  }

  if (awaiting && awaiting.sessionId !== payload.sessionId) {
    console.warn('[session:result] session id mismatch', {
      expected: awaiting.sessionId,
      received: payload.sessionId
    })
  }

  const origin: SessionOrigin = awaiting
    ? originOfAwaiting(awaiting)
    : {
        sessionId: payload.sessionId,
        exerciseId: payload.exerciseId,
        triggeredAt: new Date().toISOString(),
        durationSec: payload.durationSec ?? 0
      }

  completeSession(origin, payload.status, {
    durationSec: validDuration(payload.durationSec),
    skipReason: payload.skipReason,
    reps: payload.reps,
    feeling: payload.feeling,
    weightKg: payload.weightKg,
    photoIds: payload.photoIds
  })
}

function handlePopupClosed(sessionId: string): void {
  if (awaiting?.sessionId !== sessionId) return
  completeSession(originOfAwaiting(awaiting), 'skipped', { skipReason: 'popup-closed' })
}

function handleMissed(sessionId: string): void {
  if (awaiting?.sessionId !== sessionId) return
  completeSession(originOfAwaiting(awaiting), 'missed')
  closePopupWindow()
}

/** Pick the next exercise from stored history + settings (CONCEPT §7). */
function pickForCycle(): Exercise {
  return pickNextExercise({
    catalog: getAvailableCatalog(),
    recentSessions: getSnapshot().sessions,
    settings: getSettings()
  })
}

/** Show the popup for one exercise and start the answer timeout. */
function trigger(reason: SessionTriggerReason): void {
  if (awaiting) return

  const sessionId = randomUUID()
  const triggeredAt = new Date().toISOString()

  awaiting = {
    sessionId,
    exercise: pickForCycle(),
    triggeredAt,
    timeout: setTimeout(() => handleMissed(sessionId), MISSED_AFTER_MS)
  }
  nextTriggerAt = null
  awayStartedAt = null
  setTrayState('standup')

  const win = createPopupWindow()
  win.once('closed', () => handlePopupClosed(sessionId))

  const payload: SessionTriggerPayload = { reason, at: triggeredAt }
  console.log('[session:trigger]', payload, awaiting.exercise.id, sessionId)
  publishLoopState()
}

/** Manual trigger from the tray or the dashboard; works while paused. */
export function triggerNow(reason: SessionTriggerReason = 'manual'): void {
  if (awaiting) {
    getPopupWindow()?.focus()
    return
  }
  trigger(reason)
}

function tick(): void {
  if (!started || paused || awaiting || nextTriggerAt === null) return

  const now = Date.now()
  const idleSec = powerMonitor.getSystemIdleTime()

  if (idleSec >= AWAY_IDLE_SEC) {
    awayStartedAt ??= now - idleSec * 1000
    return
  }

  if (awayStartedAt !== null) {
    const awayMs = now - awayStartedAt
    awayStartedAt = null
    if (awayMs >= REST_IDLE_SEC * 1000) {
      nextTriggerAt = now + intervalMs()
      publishLoopState()
      return
    }
    if (nextTriggerAt <= now) {
      trigger('idle')
      return
    }
  }

  if (nextTriggerAt <= now) trigger('timer')
}

export function startTriggerLoop(): void {
  if (started) return
  started = true

  const settings = getSettings()
  paused = settings.paused
  lastIntervalMinutes = settings.intervalMinutes
  setTrayPaused(paused)
  refreshTrayMenu()

  if (!paused) {
    nextTriggerAt = Math.max(dueFrom(Date.now()), Date.now() + STARTUP_GRACE_MS)
  }

  ticker = setInterval(tick, TICK_MS)
  publishLoopState()
}

export function stopTriggerLoop(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
  if (awaiting) clearTimeout(awaiting.timeout)
  awaiting = null
  started = false
}

/** Persist pause and let the schedule follow it. */
export function setPaused(next: boolean): void {
  const settings = getSettings()
  if (settings.paused === next) return
  updateSettings({ ...settings, paused: next })
  notifyDataUpdated()
  syncLoopFromSettings()
}

/** Re-read settings after any save: interval, pause, and tray menu follow the stored values. */
export function syncLoopFromSettings(): void {
  const settings = getSettings()
  const wasPaused = paused
  const intervalChanged =
    lastIntervalMinutes !== null && lastIntervalMinutes !== settings.intervalMinutes

  paused = settings.paused
  lastIntervalMinutes = settings.intervalMinutes
  setTrayPaused(paused)
  refreshTrayMenu()
  refreshTrayAnimation()

  const now = Date.now()
  if (awaiting) {
    // The open popup resolves first; its completion schedules the next trigger.
  } else if (paused) {
    nextTriggerAt = null
  } else if (wasPaused) {
    nextTriggerAt = now + RESCHEDULE_GRACE_MS
  } else if (intervalChanged || nextTriggerAt === null) {
    nextTriggerAt = Math.max(now + RESCHEDULE_GRACE_MS, dueFrom(now))
  }

  publishLoopState()
}
