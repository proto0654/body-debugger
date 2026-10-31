import type { Session, SessionExtras, SessionStatus } from './session'
import type { Exercise } from './exercise'
import type { AppSettings } from './settings'
import type { UserProgress } from './progress'
import type { DataSnapshot } from './persistence'
import type { PhotoEntry } from './photo'
import type { AppChannel } from '../domain/app-identity'
import type { UpdateState } from '../domain/update'

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
  WindowNavigateDashboard: 'window:navigate-dashboard',
  WindowClosePopup: 'window:close-popup',
  WindowOpenPopup: 'window:open-popup',
  WindowResizePopup: 'window:resize-popup',
  DataGetSnapshot: 'data:get-snapshot',
  DataSaveSettings: 'data:save-settings',
  DataSaveProgress: 'data:save-progress',
  DataAddWeight: 'data:add-weight',
  DataRemoveWeight: 'data:remove-weight',
  DataUpdated: 'data:updated',
  DebugApplyScenario: 'debug:apply-scenario',
  LabOpen: 'lab:open',
  LabGetState: 'lab:get-state',
  LabCommand: 'lab:command',
  LabChanged: 'lab:changed',
  LabDriver: 'lab:driver',
  LabDriverAck: 'lab:driver-ack',
  PhotoList: 'photo:list',
  PhotoAdd: 'photo:add',
  PhotoRemove: 'photo:remove',
  PhotosUpdated: 'photos:updated',
  ExerciseListCustom: 'exercise:list-custom',
  ExerciseAddCustom: 'exercise:add-custom',
  ExerciseRemoveCustom: 'exercise:remove-custom',
  ExercisesUpdated: 'exercise:updated',
  AppGetInfo: 'app:get-info',
  AppOpenLogs: 'app:open-logs',
  AppGetLaunchAtLogin: 'app:get-launch-at-login',
  AppSetLaunchAtLogin: 'app:set-launch-at-login',
  AppUpdateState: 'app:update-state',
  AppUpdateCheck: 'app:update-check',
  AppUpdateInstall: 'app:update-install',
  AppUpdateDismiss: 'app:update-dismiss',
  AppUpdateChanged: 'app:update-changed'
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

export interface SessionResultPayload extends SessionExtras {
  sessionId: string
  exerciseId: string
  status: SessionStatus
  durationSec?: number
  skipReason?: string
}

/** Only a durable main-process write may confirm a result to the popup. */
export interface SessionResultResponse {
  saved: boolean
}

export interface SessionUpdatedPayload {
  session: Session
  trayState: TrayState
}

export interface TraySetStatePayload {
  state: TrayState
}

/** The tray and the laboratory open or focus the dashboard at a concrete tab. */
export interface WindowNavigateDashboardPayload {
  tab: 'today' | 'settings' | 'debug'
}

export type DataSnapshotPayload = DataSnapshot

export type DataSaveSettingsPayload = AppSettings

export type DataSaveProgressPayload = UserProgress

/** Manual weight measurement from the dashboard (optional layer). */
export interface DataAddWeightPayload {
  weightKg: number
  /** ISO timestamp; defaults to "now" in main */
  at?: string
}

export interface DataRemoveWeightPayload {
  id: string
}

export type DataUpdatedPayload = DataSnapshot

/**
 * Debug-only scenario payload (docs/TESTING.md). It replaces the session history
 * and settings with a deterministic preset; main re-validates both.
 */
export interface DebugApplyScenarioPayload {
  sessions: Session[]
  settings: AppSettings
  progress: UserProgress
}

/** Optional photo layer: raw bytes are validated and written by main only. */
export interface PhotoAddPayload {
  bytes: Uint8Array
  mimeType: string
  sessionId?: string
}

export interface PhotoRemovePayload {
  id: string
}

export type PhotoListPayload = PhotoEntry[]

export interface PhotosUpdatedPayload {
  photos: PhotoEntry[]
}

/** User-approved AI exercises (optional layer). */
export interface ExerciseAddCustomPayload {
  exercise: Exercise
}

export interface ExerciseRemoveCustomPayload {
  id: string
}

export type ExerciseListCustomPayload = Exercise[]

export interface ExercisesUpdatedPayload {
  exercises: Exercise[]
}

/**
 * Build identity for «О программе» — lets a tester report the exact build
 * and gives support the profile and log locations without asking for them.
 */
export interface AppInfoPayload {
  version: string
  buildCommit: string
  buildDate: string
  packaged: boolean
  /** Stable prod or the separate dev build; also shown in «О программе». */
  channel: AppChannel
  platform: string
  dataPath: string
  logDir: string
}

export type UpdateStatePayload = UpdateState

/**
 * `reason` explains a refused restart: an open popup must never be interrupted
 * by an update, and a not-ready update cannot be installed.
 */
export interface UpdateInstallResult {
  started: boolean
  reason: 'not-ready' | 'popup-open' | null
}
