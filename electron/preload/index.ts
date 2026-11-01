import { contextBridge, ipcRenderer } from 'electron'
import type { LabCommand, LabState } from '../../shared/domain/laboratory'
import type { LabDriverAck, LabDriverCommand } from '../../shared/domain/laboratory-playback'
import type { LaunchAtLoginState } from '../../shared/domain/launch-at-login'
import type { ChronicleCommand, ChroniclePlaybackState } from '../../shared/domain/chronicle-playback'
import type { PlaybackCoordinatorState, PlaybackOwner } from '../../shared/domain/playback-coordinator'
import type { LabBridgeMethod } from '../../shared/types/lab-bridge'
import {
  IpcChannels,
  type AppInfoPayload,
  type UpdateInstallResult,
  type UpdateStatePayload,
  type DataAddWeightPayload,
  type DataRemoveWeightPayload,
  type DataSaveProgressPayload,
  type DataSaveSettingsPayload,
  type DataSnapshotPayload,
  type DataUpdatedPayload,
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
  type TraySetStatePayload,
  type WindowNavigateDashboardPayload
} from '../../shared/types/events'

const api = {
  registerLabHost: (): void => {
    ipcRenderer.send(IpcChannels.LabViewRegister)
  },
  labBridgeRequest: (method: LabBridgeMethod, payload?: unknown): Promise<unknown> =>
    ipcRenderer.invoke(IpcChannels.LabBridgeRequest, { method, payload }),
  getAppInfo: (): Promise<AppInfoPayload> => ipcRenderer.invoke(IpcChannels.AppGetInfo),
  openLogs: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.AppOpenLogs),
  getUpdateState: (): Promise<UpdateStatePayload> => ipcRenderer.invoke(IpcChannels.AppUpdateState),
  checkForUpdates: (): Promise<UpdateStatePayload> => ipcRenderer.invoke(IpcChannels.AppUpdateCheck),
  installUpdate: (): Promise<UpdateInstallResult> => ipcRenderer.invoke(IpcChannels.AppUpdateInstall),
  dismissUpdatePrompt: (): Promise<void> => ipcRenderer.invoke(IpcChannels.AppUpdateDismiss),
  getLaunchAtLogin: (): Promise<LaunchAtLoginState> => ipcRenderer.invoke(IpcChannels.AppGetLaunchAtLogin),
  setLaunchAtLogin: (enabled: boolean): Promise<LaunchAtLoginState> =>
    ipcRenderer.invoke(IpcChannels.AppSetLaunchAtLogin, enabled),
  onUpdateState: (handler: (state: UpdateStatePayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateStatePayload): void => handler(state)
    ipcRenderer.on(IpcChannels.AppUpdateChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.AppUpdateChanged, listener)
  },
  labDriverAck: (ack: LabDriverAck): Promise<void> => ipcRenderer.invoke(IpcChannels.LabDriverAck, ack),
  onLabDriver: (handler: (command: LabDriverCommand) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: LabDriverCommand): void => handler(command)
    ipcRenderer.on(IpcChannels.LabDriver, listener)
    return () => ipcRenderer.removeListener(IpcChannels.LabDriver, listener)
  },
  getLabState: (): Promise<LabState> => ipcRenderer.invoke(IpcChannels.LabGetState),
  labCommand: (command: LabCommand): Promise<LabState> => ipcRenderer.invoke(IpcChannels.LabCommand, command),
  onLabChanged: (handler: (state: LabState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: LabState): void => handler(state)
    ipcRenderer.on(IpcChannels.LabChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.LabChanged, listener)
  },
  getPlaybackState: (): Promise<PlaybackCoordinatorState> =>
    ipcRenderer.invoke(IpcChannels.PlaybackGetState),
  beginPlayback: (owner: PlaybackOwner): Promise<PlaybackCoordinatorState> =>
    ipcRenderer.invoke(IpcChannels.PlaybackBegin, owner),
  endPlayback: (owner: PlaybackOwner): Promise<PlaybackCoordinatorState> =>
    ipcRenderer.invoke(IpcChannels.PlaybackEnd, owner),
  onPlaybackChanged: (handler: (state: PlaybackCoordinatorState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PlaybackCoordinatorState): void =>
      handler(state)
    ipcRenderer.on(IpcChannels.PlaybackChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.PlaybackChanged, listener)
  },
  getChroniclePlaybackState: (): Promise<ChroniclePlaybackState> =>
    ipcRenderer.invoke(IpcChannels.ChronicleGetState),
  chronicleCommand: (command: ChronicleCommand): Promise<ChroniclePlaybackState> =>
    ipcRenderer.invoke(IpcChannels.ChronicleCommand, command),
  onChronicleChanged: (handler: (state: ChroniclePlaybackState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ChroniclePlaybackState): void =>
      handler(state)
    ipcRenderer.on(IpcChannels.ChronicleChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.ChronicleChanged, listener)
  },
  openPopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowOpenPopup),
  closePopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowClosePopup),
  resizePopup: (height: number): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.WindowResizePopup, height),
  sessionResult: (payload: SessionResultPayload): Promise<SessionResultResponse> =>
    ipcRenderer.invoke(IpcChannels.SessionResult, payload),
  onNavigateDashboard: (handler: (payload: WindowNavigateDashboardPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: WindowNavigateDashboardPayload): void => handler(payload)
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
