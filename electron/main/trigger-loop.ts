import { randomUUID } from 'node:crypto'
import { getLaboratoryClock, nowDate, nowMs } from '../../shared/domain/clock'
import { computeCharacterCondition } from '../../shared/domain/character-condition'
import { ringProgress } from '../../shared/domain/tray-countdown'
import { paintTrayPortrait, setTrayPortraitRepaint, stopTrayPortrait } from './tray-portrait'
import { powerMonitor } from 'electron'
import { getAvailableCatalog } from './custom-exercises'
import { pickNextExercise } from '../../shared/domain/exercise-picker'
import { dose } from '../../shared/domain/dose'
import { upgradeExercise } from '../../shared/domain/exercise-v2'
import { normalizeSessionExtras } from '../../shared/domain/session-extras'
import { normalizePhotoIds } from '../../shared/domain/photos'
import { getPhoto } from './photos'
import {
  IpcChannels,
  type SessionLoopStatePayload,
  type SessionPopupCharacter,
  type SessionPopupPayload,
  type SessionResultPayload,
  type SessionResultResponse,
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
import { isLabProcess } from './lab-environment'
import { isReminderDeferred } from './playback-coordinator'

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
  timeout: NodeJS.Timeout | undefined
  deadline: number
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
/** When the current wait started. Together with `nextTriggerAt` this is the ring. */
let countdownAnchorAt: number | null = null
/** Ring fill frozen at the moment reminders were paused. */
let heldProgress: number | null = null
let awayStartedAt: number | null = null
let awaiting: AwaitingResult | null = null
let successTimer: NodeJS.Timeout | null = null
/** Preview popups (chronicle) resolve without writing real history. */
let previewMode = false
/** Isolated portrait for chronicle/arcade preview; cleared with preview mode. */
let previewCharacter: SessionPopupCharacter | null = null
/** At most one deferred real timer reminder while playback/grace is active. */
let deferredTimerDue = false

interface LoopSimulation {
  hold: boolean
  idleSeconds: number | null
  failNextWrite: boolean
  freezeDeadline: boolean
  onTriggered?: () => void
  onResolved?: (session: Session) => void
}
const simulation: LoopSimulation = { hold: false, idleSeconds: null, failNextWrite: false, freezeDeadline: false }

/** Only the isolated laboratory controller supplies these runtime dependencies. */
export function configureLoopSimulation(next: Partial<LoopSimulation>): void {
  Object.assign(simulation, next)
  if (awaiting) armResultDeadline()
}

export function setSessionPreviewMode(next: boolean): void {
  previewMode = next
  if (!next) previewCharacter = null
}

export function setPreviewCharacter(next: SessionPopupCharacter | null): void {
  previewCharacter = next
}

/** After playback grace ends, fire at most one deferred timer reminder. */
export function flushDeferredReminder(): void {
  if (!deferredTimerDue || isReminderDeferred() || paused || awaiting || getPopupWindow()) return
  deferredTimerDue = false
  trigger('timer')
}

function armResultDeadline(): void {
  if (!awaiting) return
  clearTimeout(awaiting.timeout)
  awaiting.timeout = undefined
  if (simulation.freezeDeadline) return
  const clock = getLaboratoryClock()
  if (clock && !clock.running) return
  const sessionId = awaiting.sessionId
  const remaining = Math.max(1, (awaiting.deadline - nowMs()) / (clock?.rate ?? 1))
  awaiting.timeout = setTimeout(() => {
    if (awaiting?.sessionId !== sessionId || simulation.freezeDeadline) return
    if (nowMs() >= awaiting.deadline) handleMissed(sessionId)
    else armResultDeadline()
  }, remaining)
}

/** Cancel before closing: a scrub must never turn a discarded popup into a skipped session. */
export function cancelLoopForLaboratory(): void {
  if (awaiting) clearTimeout(awaiting.timeout)
  awaiting = null
  if (successTimer) clearTimeout(successTimer)
  successTimer = null
  simulation.failNextWrite = false
  previewMode = false
  awayStartedAt = null
  clearCountdown()
  heldProgress = null
  closePopupWindow()
  setTrayState('idle')
  refreshTrayPortrait()
}

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
  refreshTrayPortrait()
}

export function getLoopState(): SessionLoopStatePayload {
  return {
    paused,
    nextTriggerAt: nextTriggerAt === null ? null : new Date(nextTriggerAt).toISOString(),
    countdownAnchorAt: countdownAnchorAt === null ? null : new Date(countdownAnchorAt).toISOString(),
    heldProgress,
    intervalMinutes: getSettings().intervalMinutes
  }
}

function assignCountdown(dueAt: number, anchorAt: number): void {
  nextTriggerAt = dueAt
  countdownAnchorAt = anchorAt < dueAt ? anchorAt : dueAt - 1
  heldProgress = null
}

function clearCountdown(): void {
  nextTriggerAt = null
  countdownAnchorAt = null
}

/** The wait that follows the last resolved session, including a short startup grace. */
function assignCountdownFromLastSession(now: number, dueAt: number): void {
  const last = lastResolvedAt()
  assignCountdown(dueAt, Math.min(last ?? now, now))
}

function holdCountdown(now: number): void {
  if (nextTriggerAt !== null && countdownAnchorAt !== null) {
    heldProgress = ringProgress(now, countdownAnchorAt, nextTriggerAt)
  }
  clearCountdown()
}

/** Redraw the tray and taskbar portrait from the current schedule and character. */
export function refreshTrayPortrait(): void {
  try {
    const settings = getSettings()
    const snapshot = getSnapshot()
    paintTrayPortrait({
      paused,
      popupOpen: Boolean(awaiting || getPopupWindow()),
      anchorAt: countdownAnchorAt,
      dueAt: nextTriggerAt,
      heldProgress,
      now: nowMs(),
      reduceMotion: settings.reduceMotion,
      trayState: getTrayState(),
      packId: settings.characterPackId,
      build: snapshot.progress.characterBuild,
      conditionLevel: computeCharacterCondition(snapshot.sessions).level
    })
  } catch (cause) {
    console.error('[tray] portrait failed', cause)
  }
}

/** The popup currently asking for a result, if any. */
export function getActivePopup(): SessionPopupPayload | null {
  return awaiting
    ? {
        sessionId: awaiting.sessionId,
        exercise: awaiting.exercise,
        preview: previewMode,
        ...(previewMode && previewCharacter ? { character: previewCharacter } : {})
      }
    : null
}

/**
 * Resolve the open popup: append the session, refresh tray, and schedule the next trigger.
 * Callers either answered the popup, closed it, or let it time out.
 */
function completeSession(
  origin: SessionOrigin,
  status: SessionStatus,
  extras: SessionCompletionExtras = {}
): SessionResultResponse {
  // Photos must already exist in the main store; stale or forged ids are dropped.
  const photoIds = status === 'done'
    ? normalizePhotoIds(extras.photoIds).filter((id) => getPhoto(id) !== null)
    : []
  const session: Session = {
    id: origin.sessionId,
    exerciseId: origin.exerciseId,
    status,
    durationSec: extras.durationSec ?? origin.durationSec,
    plannedSec: origin.durationSec,
    triggeredAt: origin.triggeredAt,
    completedAt: nowDate().toISOString(),
    // Untrusted renderer input: only in-range details are stored.
    ...(status === 'done' ? normalizeSessionExtras(extras) : {}),
    ...(photoIds.length > 0 ? { photoIds } : {})
  }
  if (typeof extras.skipReason === 'string') session.skipReason = extras.skipReason.slice(0, 500)

  if (previewMode) {
    // Chronicle / preview: drive NativePlayback without touching the real profile.
    if (awaiting?.sessionId === origin.sessionId) {
      clearTimeout(awaiting.timeout)
      awaiting = null
    }
    simulation.onResolved?.(session)
    awayStartedAt = null
    publishLoopState()
    return { saved: true }
  }

  try {
    if (simulation.failNextWrite) {
      simulation.failNextWrite = false
      throw new Error('Laboratory: simulated session write failure')
    }
    appendSession(session)
  } catch (error) {
    console.error('[trigger-loop] failed to persist session', error)
    return { saved: false }
  }
  if (awaiting?.sessionId === origin.sessionId) {
    clearTimeout(awaiting.timeout)
    awaiting = null
  }
  try {
    if (status === 'done') applyDoneSession()
  } catch (error) {
    console.error('[trigger-loop] session saved; progress write failed', error)
  }
  const trayState = trayStateFor(status)
  setTrayState(trayState)
  broadcastToWindows(IpcChannels.SessionUpdated, { session, trayState })
  if (trayState === 'success') {
    if (successTimer) clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      if (getTrayState() === 'success') setTrayState('idle')
      successTimer = null
      refreshTrayPortrait()
    }, 1500)
  }

  const now = nowMs()
  awayStartedAt = null
  if (paused) {
    clearCountdown()
    heldProgress = null
  } else if (status === 'snoozed') assignCountdown(now + SNOOZE_MINUTES * 60_000, now)
  else assignCountdown(now + intervalMs(), now)

  publishLoopState()
  simulation.onResolved?.(session)
  notifyDataUpdated()
  return { saved: true }
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
export function handleSessionResult(payload: SessionResultPayload): SessionResultResponse {
  // Untrusted IPC: never write an unknown status or a session without identity.
  if (!payload || !SESSION_STATUSES.includes(payload.status)) {
    console.warn('[session:result] unknown status', payload?.status)
    return { saved: false }
  }
  const stored = getSnapshot().sessions.find((session) => session.id === payload.sessionId)
  if (stored) {
    return { saved: stored.exerciseId === payload.exerciseId && stored.status === payload.status }
  }
  if (!awaiting || awaiting.sessionId !== payload.sessionId || awaiting.exercise.id !== payload.exerciseId) {
    console.warn('[session:result] no matching active session')
    return { saved: false }
  }
  return completeSession(originOfAwaiting(awaiting), payload.status, {
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

/**
 * Arcade playback: resolve the open popup as missed immediately.
 * Chronicle has no laboratory clock, so deadline ticks never fire there.
 */
export function missActivePopup(): void {
  if (!awaiting) return
  handleMissed(awaiting.sessionId)
}

/** Pick the next exercise from stored history + settings (CONCEPT §7 / CATALOG-V2). */
function pickForCycle(): Exercise {
  const settings = getSettings()
  const exercise = pickNextExercise({
    catalog: getAvailableCatalog(),
    recentSessions: getSnapshot().sessions,
    settings,
    now: nowDate()
  })
  const v2 = upgradeExercise(exercise)
  const scale = settings.overrides?.[exercise.id]?.scale ?? 1
  const plannedSec = dose(v2.timer, settings.intervalMinutes, scale)
  return { ...exercise, durationSec: plannedSec }
}

/** Show the popup for one exercise and start the answer timeout. */
function trigger(reason: SessionTriggerReason, exercise?: Exercise): void {
  if (awaiting) return
  if (!previewMode && isReminderDeferred() && (reason === 'timer' || reason === 'idle' || reason === 'manual')) {
    if (reason === 'timer' || reason === 'idle') deferredTimerDue = true
    return
  }

  const sessionId = randomUUID()
  const triggeredAt = nowDate().toISOString()

  awaiting = {
    sessionId,
    exercise: exercise ?? pickForCycle(),
    triggeredAt,
    deadline: nowMs() + MISSED_AFTER_MS,
    timeout: undefined
  }
  clearCountdown()
  awayStartedAt = null
  setTrayState('standup')

  const win = createPopupWindow()
  armResultDeadline()
  win.once('closed', () => handlePopupClosed(sessionId))

  const payload: SessionTriggerPayload = { reason, at: triggeredAt }
  console.log('[session:trigger]', payload, awaiting.exercise.id, sessionId)
  publishLoopState()
  simulation.onTriggered?.()
}

/** Manual trigger from the tray or the dashboard; works while paused. */
export function triggerNow(reason: SessionTriggerReason = 'manual'): void {
  if (awaiting || getPopupWindow()) {
    getPopupWindow()?.focus()
    return
  }
  if (isReminderDeferred()) return
  trigger(reason)
}

/** The isolated controller may choose a resolved exercise, but never write its outcome. */
export function triggerLaboratoryExercise(exerciseId: string, durationSec?: number): SessionPopupPayload {
  if (!isLabProcess()) throw new Error('Native action driver requires the isolated laboratory')
  if (awaiting || getPopupWindow()) throw new Error('Another popup is still open')
  const exercise = getAvailableCatalog().find(candidate => candidate.id === exerciseId)
  if (!exercise) throw new Error('Unknown laboratory exercise')
  if (durationSec !== undefined && (!Number.isFinite(durationSec) || durationSec < 0 || durationSec > 86400)) throw new Error('Invalid laboratory exercise duration')
  trigger('event', durationSec === undefined ? exercise : { ...exercise, durationSec })
  return getActivePopup()!
}

/** Chronicle preview: same native popup path, no durable write (previewMode). */
export function triggerPreviewExercise(exerciseId: string, durationSec?: number): SessionPopupPayload {
  if (isLabProcess()) throw new Error('Preview playback belongs to the main profile')
  if (awaiting || getPopupWindow()) throw new Error('Another popup is still open')
  const exercise = getAvailableCatalog().find(candidate => candidate.id === exerciseId)
  if (!exercise) throw new Error('Unknown chronicle exercise')
  if (durationSec !== undefined && (!Number.isFinite(durationSec) || durationSec < 0 || durationSec > 86400)) {
    throw new Error('Invalid chronicle exercise duration')
  }
  previewMode = true
  trigger('event', durationSec === undefined ? exercise : { ...exercise, durationSec })
  return getActivePopup()!
}

function tick(): void {
  try {
    if (awaiting && !simulation.freezeDeadline && nowMs() >= awaiting.deadline) handleMissed(awaiting.sessionId)
    if (!started || simulation.hold || paused || awaiting || getPopupWindow() || nextTriggerAt === null) return

    const now = nowMs()
    const idleSec = simulation.idleSeconds ?? powerMonitor.getSystemIdleTime()

    if (idleSec >= AWAY_IDLE_SEC) {
      awayStartedAt ??= now - idleSec * 1000
      return
    }

    if (awayStartedAt !== null) {
      const awayMs = now - awayStartedAt
      awayStartedAt = null
      if (awayMs >= REST_IDLE_SEC * 1000) {
        assignCountdown(now + intervalMs(), now)
        publishLoopState()
        return
      }
      if (nextTriggerAt !== null && nextTriggerAt <= now) {
        if (isReminderDeferred()) {
          deferredTimerDue = true
          clearCountdown()
          publishLoopState()
          return
        }
        trigger('idle')
        return
      }
    }

    if (nextTriggerAt !== null && nextTriggerAt <= now) {
      if (isReminderDeferred()) {
        deferredTimerDue = true
        clearCountdown()
        publishLoopState()
        return
      }
      trigger('timer')
    }
  } finally {
    if (started) refreshTrayPortrait()
  }
}

export function tickTriggerLoop(): void { tick() }

export function startTriggerLoop(): void {
  if (started) return
  started = true

  const settings = getSettings()
  paused = settings.paused
  lastIntervalMinutes = settings.intervalMinutes
  setTrayPaused(paused)
  refreshTrayMenu()

  if (!paused) {
    assignCountdownFromLastSession(nowMs(), Math.max(dueFrom(nowMs()), nowMs() + STARTUP_GRACE_MS))
  }

  ticker = setInterval(tick, TICK_MS)
  publishLoopState()
}

export function stopTriggerLoop(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
  if (awaiting) clearTimeout(awaiting.timeout)
  awaiting = null
  if (successTimer) clearTimeout(successTimer)
  successTimer = null
  started = false
  stopTrayPortrait()
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

  const now = nowMs()
  if (awaiting) {
    // The open popup resolves first; its completion schedules the next trigger.
  } else if (paused) {
    if (nextTriggerAt !== null) holdCountdown(now)
  } else if (wasPaused) {
    assignCountdown(now + RESCHEDULE_GRACE_MS, now)
  } else if (intervalChanged || nextTriggerAt === null) {
    assignCountdownFromLastSession(now, Math.max(now + RESCHEDULE_GRACE_MS, dueFrom(now)))
  }

  publishLoopState()
}

setTrayPortraitRepaint(() => { refreshTrayPortrait() })
