/// <reference types="vite/client" />
import type { LabCommand, LabState } from '@shared/domain/laboratory'
import type { LabDriverAck, LabDriverCommand } from '@shared/domain/laboratory-playback'
import type { LaunchAtLoginState } from '@shared/domain/launch-at-login'
import type { TrayPinState } from '@shared/domain/tray-pin'
import type { ChronicleCommand, ChroniclePlaybackState } from '@shared/domain/chronicle-playback'
import type { PlaybackCoordinatorState, PlaybackOwner } from '@shared/domain/playback-coordinator'
import type { LabBridgeMethod } from '@shared/types/lab-bridge'

import type {
  AppInfoPayload,
  UpdateInstallResult,
  UpdateStatePayload,
  DataAddWeightPayload,
  DataRemoveWeightPayload,
  DataSaveProgressPayload,
  DataSaveSettingsPayload,
  DataSnapshotPayload,
  DataUpdatedPayload,
  PhotoAddPayload,
  PhotoListPayload,
  PhotoRemovePayload,
  PhotosUpdatedPayload,
  ExerciseAddCustomPayload,
  ExerciseListCustomPayload,
  ExerciseRemoveCustomPayload,
  ExercisesUpdatedPayload,
  SessionLoopStatePayload,
  SessionPopupPayload,
  SessionResultPayload,
  SessionResultResponse,
  TraySetStatePayload,
  WindowNavigateDashboardPayload,
  LlmConfigPayload,
  LlmSaveConfigPayload,
  LlmSetKeyPayload,
  LlmPreviewRequestPayload,
  LlmPreviewResponsePayload,
  LlmRunPayload,
  LlmToggleOpPayload,
  LlmChangedPayload,
  CatalogListPayload,
  CatalogUpdatedPayload,
  CatalogSetStatusPayload,
  CatalogSetBatchEnabledPayload,
  CatalogRenameBatchPayload,
  CatalogCreateBatchPayload,
  CatalogManualEditPayload,
  BreakQueuePayload
} from '@shared/types/events'
import type { Changeset } from '@shared/domain/changeset'
import type { CatalogBatch } from '@shared/types/exercise-v2'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

export interface BodyDebuggerApi {
  registerLabHost?: () => void
  labBridgeRequest?: (method: LabBridgeMethod, payload?: unknown) => Promise<unknown>
  getAppInfo: () => Promise<AppInfoPayload>
  openLogs: () => Promise<boolean>
  getUpdateState: () => Promise<UpdateStatePayload>
  checkForUpdates: () => Promise<UpdateStatePayload>
  installUpdate: () => Promise<UpdateInstallResult>
  dismissUpdatePrompt: () => Promise<void>
  getLaunchAtLogin: () => Promise<LaunchAtLoginState>
  setLaunchAtLogin: (enabled: boolean) => Promise<LaunchAtLoginState>
  getTrayPin: () => Promise<TrayPinState>
  setTrayPin: (enabled: boolean) => Promise<TrayPinState>
  onUpdateState: (handler: (state: UpdateStatePayload) => void) => () => void
  labDriverAck: (ack: LabDriverAck) => Promise<void>
  onLabDriver: (handler: (command: LabDriverCommand) => void) => () => void
  getLabState: () => Promise<LabState>
  labCommand: (command: LabCommand) => Promise<LabState>
  onLabChanged: (handler: (state: LabState) => void) => () => void
  getPlaybackState?: () => Promise<PlaybackCoordinatorState>
  beginPlayback?: (owner: PlaybackOwner) => Promise<PlaybackCoordinatorState>
  endPlayback?: (owner: PlaybackOwner) => Promise<PlaybackCoordinatorState>
  onPlaybackChanged?: (handler: (state: PlaybackCoordinatorState) => void) => () => void
  getChroniclePlaybackState?: () => Promise<ChroniclePlaybackState>
  chronicleCommand?: (command: ChronicleCommand) => Promise<ChroniclePlaybackState>
  onChronicleChanged?: (handler: (state: ChroniclePlaybackState) => void) => () => void
  openPopup: () => Promise<void>
  closePopup: () => Promise<void>
  resizePopup: (height: number) => Promise<void>
  sessionResult: (payload: SessionResultPayload) => Promise<SessionResultResponse>
  onNavigateDashboard: (handler: (payload: WindowNavigateDashboardPayload) => void) => () => void
  getCurrentPopup: () => Promise<SessionPopupPayload | null>
  getLoopState: () => Promise<SessionLoopStatePayload>
  getSnapshot: () => Promise<DataSnapshotPayload>
  saveSettings: (payload: DataSaveSettingsPayload) => Promise<DataSnapshotPayload>
  saveProgress: (payload: DataSaveProgressPayload) => Promise<DataSnapshotPayload>
  addWeight: (payload: DataAddWeightPayload) => Promise<DataSnapshotPayload>
  removeWeight: (payload: DataRemoveWeightPayload) => Promise<DataSnapshotPayload>
  listPhotos: () => Promise<PhotoListPayload>
  addPhoto: (payload: PhotoAddPayload) => Promise<PhotoListPayload[number] | null>
  removePhoto: (
    payload: PhotoRemovePayload
  ) => Promise<{ removed: boolean; photos: PhotoListPayload }>
  listCustomExercises: () => Promise<ExerciseListCustomPayload>
  addCustomExercise: (
    payload: ExerciseAddCustomPayload
  ) => Promise<{
    exercise: ExerciseListCustomPayload[number] | null
    exercises: ExerciseListCustomPayload
  }>
  removeCustomExercise: (
    payload: ExerciseRemoveCustomPayload
  ) => Promise<{ removed: boolean; exercises: ExerciseListCustomPayload }>
  onLoopStateChanged: (handler: (payload: SessionLoopStatePayload) => void) => () => void
  onTrayState: (handler: (payload: TraySetStatePayload) => void) => () => void
  onDataUpdated: (handler: (payload: DataUpdatedPayload) => void) => () => void
  onPhotosUpdated: (handler: (payload: PhotosUpdatedPayload) => void) => () => void
  onExercisesUpdated: (handler: (payload: ExercisesUpdatedPayload) => void) => () => void
  getLlmConfig: () => Promise<LlmConfigPayload>
  saveLlmConfig: (payload: LlmSaveConfigPayload) => Promise<LlmConfigPayload>
  setLlmKey: (payload: LlmSetKeyPayload) => Promise<LlmConfigPayload>
  testLlm: () => Promise<{ ok: boolean; message: string }>
  previewLlmRequest: (payload: LlmPreviewRequestPayload) => Promise<LlmPreviewResponsePayload>
  runLlm: (payload: LlmRunPayload) => Promise<Changeset>
  cancelLlm: () => Promise<{ cancelled: boolean }>
  getLlmChangeset: (id: string) => Promise<Changeset | null>
  listLlmChangesets: () => Promise<Changeset[]>
  toggleLlmOp: (payload: LlmToggleOpPayload) => Promise<Changeset | null>
  applyLlmChangeset: (changesetId: string) => Promise<Changeset | null>
  discardLlmChangeset: (changesetId: string) => Promise<Changeset | null>
  revertLlmChangeset: (changesetId: string) => Promise<Changeset | null>
  listCatalog: () => Promise<CatalogListPayload>
  setCatalogStatus: (
    payload: CatalogSetStatusPayload
  ) => Promise<{ ok: boolean } & CatalogListPayload>
  setCatalogBatchEnabled: (
    payload: CatalogSetBatchEnabledPayload
  ) => Promise<{ ok: boolean } & CatalogListPayload>
  renameCatalogBatch: (
    payload: CatalogRenameBatchPayload
  ) => Promise<{ ok: boolean } & CatalogListPayload>
  createCatalogBatch: (
    payload: CatalogCreateBatchPayload
  ) => Promise<{ ok: boolean; batch: CatalogBatch | null } & CatalogListPayload>
  applyCatalogManualEdit: (
    payload: CatalogManualEditPayload
  ) => Promise<{ ok: boolean; changeset: Changeset } & CatalogListPayload>
  getBreakQueue: () => Promise<BreakQueuePayload>
  saveBreakQueue: (payload: BreakQueuePayload) => Promise<BreakQueuePayload>
  onLlmChanged: (handler: (payload: LlmChangedPayload) => void) => () => void
  onCatalogUpdated: (handler: (payload: CatalogUpdatedPayload) => void) => () => void
}

declare global {
  interface Window {
    api: BodyDebuggerApi
  }
}

export {}
