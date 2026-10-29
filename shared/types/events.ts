import type { Session, SessionStatus } from './session'
import type { Exercise } from './exercise'
import type { AppSettings } from './settings'
import type { UserProgress } from './progress'
import type { DataSnapshot } from './persistence'

/** Tray visual states from CONCEPT.md §4 / §13 */
export type TrayState = 'idle' | 'soon' | 'standup' | 'success' | 'streak'

/**
 * IPC / session-cycle channel names.
 * trigger → get-current-popup → result → updated → tray:set-state
 * loop-changed — schedule / pause state after every reschedule
 * data:* — main-owned JSON persistence
 */
export const IpcChannels = {
  SessionGetCurrentPopup: 'session:get-current-popup',
  SessionGetLoopState: 'session:get-loop-state',
  SessionLoopChanged: 'session:loop-changed',
  SessionResult: 'session:result',
  SessionUpdated: 'session:updated',
  TraySetState: 'tray:set-state',
  WindowOpenDashboard: 'window:open-dashboard',
  WindowClosePopup: 'window:close-popup',
  WindowOpenPopup: 'window:open-popup',
  DataGetSnapshot: 'data:get-snapshot',
  DataSaveSettings: 'data:save-settings',
  DataSaveProgress: 'data:save-progress',
  DataUpdated: 'data:updated'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

/** Why the reminder fired (CONCEPT.md §2) */
export type SessionTriggerReason = 'timer' | 'idle' | 'event' | 'manual'

export interface SessionTriggerPayload {
  reason: SessionTriggerReason
  at: string
}

/** The single exercise the popup must show; main is the source of truth for the active session. */
export interface SessionPopupPayload {
  exercise: Exercise
  sessionId: string
}

/** Runtime reminder schedule — derived state, never persisted */
export interface SessionLoopStatePayload {
  paused: boolean
  /** ISO timestamp of the next reminder, null while paused or a popup is open */
  nextTriggerAt: string | null
  intervalMinutes: number
}

export interface SessionResultPayload {
  sessionId: string
  exerciseId: string
  status: SessionStatus
  durationSec?: number
  skipReason?: string
}

export interface SessionUpdatedPayload {
  session: Session
  trayState: TrayState
}

export interface TraySetStatePayload {
  state: TrayState
}

export type DataSnapshotPayload = DataSnapshot

export type DataSaveSettingsPayload = AppSettings

export type DataSaveProgressPayload = UserProgress

export type DataUpdatedPayload = DataSnapshot
