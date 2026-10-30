import { contextBridge, ipcRenderer } from 'electron'
import type { LabCommand, LabState } from '../../shared/domain/laboratory'
import {
  IpcChannels,
  type DataAddWeightPayload,
  type DataRemoveWeightPayload,
  type DataSaveProgressPayload,
  type DataSaveSettingsPayload,
  type DataSnapshotPayload,
  type DataUpdatedPayload,
  type DebugApplyScenarioPayload,
  type PhotoAddPayload,
  type PhotoListPayload,
  type PhotoRemovePayload,
  type PhotosUpdatedPayload,
  type ExerciseAddCustomPayload,
  type ExerciseListCustomPayload,
  type ExerciseRemoveCustomPayload,
  type ExercisesUpdatedPayload,
  type SessionLoopStatePayload,
  type SessionPopupPayload,
  type SessionResultPayload,
  type SessionResultResponse,
  type TraySetStatePayload
} from '../../shared/types/events'

const api = {
  openLaboratory: (): Promise<void> => ipcRenderer.invoke(IpcChannels.LabOpen),
  getLabState: (): Promise<LabState> => ipcRenderer.invoke(IpcChannels.LabGetState),
  labCommand: (command: LabCommand): Promise<LabState> => ipcRenderer.invoke(IpcChannels.LabCommand, command),
  onLabChanged: (handler: (state: LabState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: LabState): void => handler(state)
    ipcRenderer.on(IpcChannels.LabChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.LabChanged, listener)
  },
  openDashboard: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowOpenDashboard),
  openPopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowOpenPopup),
  closePopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowClosePopup),
  resizePopup: (height: number): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.WindowResizePopup, height),
  sessionResult: (payload: SessionResultPayload): Promise<SessionResultResponse> =>
    ipcRenderer.invoke(IpcChannels.SessionResult, payload),
  onNavigateDashboard: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IpcChannels.WindowNavigateDashboard, listener)
    return () => ipcRenderer.removeListener(IpcChannels.WindowNavigateDashboard, listener)
  },
  getCurrentPopup: (): Promise<SessionPopupPayload | null> =>
    ipcRenderer.invoke(IpcChannels.SessionGetCurrentPopup),
  getLoopState: (): Promise<SessionLoopStatePayload> =>
    ipcRenderer.invoke(IpcChannels.SessionGetLoopState),
  getSnapshot: (): Promise<DataSnapshotPayload> =>
    ipcRenderer.invoke(IpcChannels.DataGetSnapshot),
  saveSettings: (payload: DataSaveSettingsPayload): Promise<DataSnapshotPayload> =>
    ipcRenderer.invoke(IpcChannels.DataSaveSettings, payload),
  saveProgress: (payload: DataSaveProgressPayload): Promise<DataSnapshotPayload> =>
    ipcRenderer.invoke(IpcChannels.DataSaveProgress, payload),
  addWeight: (payload: DataAddWeightPayload): Promise<DataSnapshotPayload> =>
    ipcRenderer.invoke(IpcChannels.DataAddWeight, payload),
  removeWeight: (payload: DataRemoveWeightPayload): Promise<DataSnapshotPayload> =>
    ipcRenderer.invoke(IpcChannels.DataRemoveWeight, payload),
  applyDebugScenario: (payload: DebugApplyScenarioPayload): Promise<DataSnapshotPayload> =>
    ipcRenderer.invoke(IpcChannels.DebugApplyScenario, payload),
  listPhotos: (): Promise<PhotoListPayload> => ipcRenderer.invoke(IpcChannels.PhotoList),
  addPhoto: (payload: PhotoAddPayload): Promise<PhotoListPayload[number] | null> =>
    ipcRenderer.invoke(IpcChannels.PhotoAdd, payload),
  removePhoto: (
    payload: PhotoRemovePayload
  ): Promise<{ removed: boolean; photos: PhotoListPayload }> =>
    ipcRenderer.invoke(IpcChannels.PhotoRemove, payload),
  listCustomExercises: (): Promise<ExerciseListCustomPayload> =>
    ipcRenderer.invoke(IpcChannels.ExerciseListCustom),
  addCustomExercise: (
    payload: ExerciseAddCustomPayload
  ): Promise<{ exercise: ExerciseListCustomPayload[number] | null; exercises: ExerciseListCustomPayload }> =>
    ipcRenderer.invoke(IpcChannels.ExerciseAddCustom, payload),
  removeCustomExercise: (
    payload: ExerciseRemoveCustomPayload
  ): Promise<{ removed: boolean; exercises: ExerciseListCustomPayload }> =>
    ipcRenderer.invoke(IpcChannels.ExerciseRemoveCustom, payload),
  onLoopStateChanged: (handler: (payload: SessionLoopStatePayload) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: SessionLoopStatePayload
    ): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.SessionLoopChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.SessionLoopChanged, listener)
  },
  onTrayState: (handler: (payload: TraySetStatePayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TraySetStatePayload): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.TraySetState, listener)
    return () => ipcRenderer.removeListener(IpcChannels.TraySetState, listener)
  },
  onDataUpdated: (handler: (payload: DataUpdatedPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: DataUpdatedPayload): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.DataUpdated, listener)
    return () => ipcRenderer.removeListener(IpcChannels.DataUpdated, listener)
  },
  onPhotosUpdated: (handler: (payload: PhotosUpdatedPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PhotosUpdatedPayload): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.PhotosUpdated, listener)
    return () => ipcRenderer.removeListener(IpcChannels.PhotosUpdated, listener)
  },
  onExercisesUpdated: (handler: (payload: ExercisesUpdatedPayload) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: ExercisesUpdatedPayload
    ): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.ExercisesUpdated, listener)
    return () => ipcRenderer.removeListener(IpcChannels.ExercisesUpdated, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
