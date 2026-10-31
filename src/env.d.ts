/// <reference types="vite/client" />
import type { LabCommand, LabState } from '@shared/domain/laboratory'
import type { LabDriverAck, LabDriverCommand } from '@shared/domain/laboratory-playback'
import type { LaunchAtLoginState } from '@shared/domain/launch-at-login'

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
  DebugApplyScenarioPayload,
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
  WindowNavigateDashboardPayload
} from '@shared/types/events'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

export interface BodyDebuggerApi {
  getAppInfo: () => Promise<AppInfoPayload>
  openLogs: () => Promise<boolean>
  getUpdateState: () => Promise<UpdateStatePayload>
  checkForUpdates: () => Promise<UpdateStatePayload>
  installUpdate: () => Promise<UpdateInstallResult>
  dismissUpdatePrompt: () => Promise<void>
  getLaunchAtLogin: () => Promise<LaunchAtLoginState>
  setLaunchAtLogin: (enabled: boolean) => Promise<LaunchAtLoginState>
  onUpdateState: (handler: (state: UpdateStatePayload) => void) => () => void
  labDriverAck: (ack: LabDriverAck) => Promise<void>
  onLabDriver: (handler: (command: LabDriverCommand) => void) => () => void
  openLaboratory: () => Promise<void>
  getLabState: () => Promise<LabState>
  labCommand: (command: LabCommand) => Promise<LabState>
  onLabChanged: (handler: (state: LabState) => void) => () => void
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
  applyDebugScenario: (payload: DebugApplyScenarioPayload) => Promise<DataSnapshotPayload>
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
}

declare global {
  interface Window {
    api: BodyDebuggerApi
  }
}

export {}
