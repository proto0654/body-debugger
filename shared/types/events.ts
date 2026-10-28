import type { Session, SessionStatus } from './session'
import type { Exercise } from './exercise'

/** Tray visual states from CONCEPT.md §4 / §13 */
export type TrayState = 'idle' | 'soon' | 'standup' | 'success' | 'streak'

/**
 * IPC / session-cycle channel names.
 * trigger → show-popup → result → updated → tray:set-state
 */
export const IpcChannels = {
  SessionTrigger: 'session:trigger',
  SessionShowPopup: 'session:show-popup',
  SessionResult: 'session:result',
  SessionUpdated: 'session:updated',
  TraySetState: 'tray:set-state',
  WindowOpenDashboard: 'window:open-dashboard',
  WindowClosePopup: 'window:close-popup',
  WindowOpenPopup: 'window:open-popup'
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
