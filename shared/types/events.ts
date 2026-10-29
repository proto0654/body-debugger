import type { Session, SessionStatus } from './session'
import type { Exercise } from './exercise'
import type { AppSettings } from './settings'
import type { UserProgress } from './progress'
import type { DataSnapshot } from './persistence'

/** Tray visual states from CONCEPT.md §4 / §13 */
export type TrayState = 'idle' | 'soon' | 'standup' | 'success' | 'streak'

/**
 * IPC / session-cycle channel names.
 * trigger → show-popup → result → updated → tray:set-state
 * data:* — main-owned JSON persistence
 */
export const IpcChannels = {
  SessionTrigger: 'session:trigger',
  SessionShowPopup: 'session:show-popup',
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

export interface SessionTriggerPayload {
  reason: 'timer' | 'idle' | 'event' | 'manual'
  at: string
}

export interface SessionShowPopupPayload {
  exercise: Exercise
  sessionId: string
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
