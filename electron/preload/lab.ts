import { contextBridge, ipcRenderer } from 'electron'
import type { LabCommand, LabState } from '../../shared/domain/laboratory'
import { LAB_BRIDGE_METHODS, type LabBridgeMethod, type LabBridgeRequest } from '../../shared/types/lab-bridge'
import { IpcChannels } from '../../shared/types/events'
import type {
  DataAddWeightPayload,
  DataRemoveWeightPayload,
  DataSaveProgressPayload,
  DataSaveSettingsPayload,
  DataSnapshotPayload,
  DataUpdatedPayload,
  ExerciseAddCustomPayload,
  ExerciseListCustomPayload,
  ExerciseRemoveCustomPayload,
  ExercisesUpdatedPayload,
  PhotoListPayload,
  PhotoRemovePayload,
  PhotosUpdatedPayload,
  SessionLoopStatePayload
} from '../../shared/types/events'

/**
 * Dedicated preload for the playground laboratory webview. It never sees the
 * real profile: every data call goes through the main-process lab bridge to the
 * headless sandbox child.
 */

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

function labRequest<T>(method: LabBridgeMethod, payload?: unknown): Promise<T> {
  const request: Omit<LabBridgeRequest, 'id'> = { method, payload }
  return ipcRenderer.invoke(IpcChannels.LabBridgeRequest, request) as Promise<T>
}

const api = {
  getSnapshot: (): Promise<DataSnapshotPayload> => labRequest(LAB_BRIDGE_METHODS.snapshot),
  saveSettings: (payload: DataSaveSettingsPayload): Promise<DataSnapshotPayload> =>
    labRequest(LAB_BRIDGE_METHODS.saveSettings, payload),
  saveProgress: (payload: DataSaveProgressPayload): Promise<DataSnapshotPayload> =>
    labRequest(LAB_BRIDGE_METHODS.saveProgress, payload),
  addWeight: (payload: DataAddWeightPayload): Promise<DataSnapshotPayload> =>
    labRequest(LAB_BRIDGE_METHODS.addWeight, payload),
  removeWeight: (payload: DataRemoveWeightPayload): Promise<DataSnapshotPayload> =>
    labRequest(LAB_BRIDGE_METHODS.removeWeight, payload),
  listPhotos: (): Promise<PhotoListPayload> => labRequest(LAB_BRIDGE_METHODS.photoList),
  removePhoto: (payload: PhotoRemovePayload): Promise<{ removed: boolean; photos: PhotoListPayload }> =>
    labRequest(LAB_BRIDGE_METHODS.photoRemove, payload),
  listCustomExercises: (): Promise<ExerciseListCustomPayload> => labRequest(LAB_BRIDGE_METHODS.exerciseList),
  addCustomExercise: (
    payload: ExerciseAddCustomPayload
  ): Promise<{ exercise: ExerciseListCustomPayload[number] | null; exercises: ExerciseListCustomPayload }> =>
    labRequest(LAB_BRIDGE_METHODS.exerciseAdd, payload),
  removeCustomExercise: (
    payload: ExerciseRemoveCustomPayload
  ): Promise<{ removed: boolean; exercises: ExerciseListCustomPayload }> =>
    labRequest(LAB_BRIDGE_METHODS.exerciseRemove, payload),
  getLoopState: (): Promise<SessionLoopStatePayload> => labRequest(LAB_BRIDGE_METHODS.loopState),
  getLabState: (): Promise<LabState> => labRequest(LAB_BRIDGE_METHODS.labState),
  labCommand: (command: LabCommand): Promise<LabState> => labRequest(LAB_BRIDGE_METHODS.labCommand, command),
  onLabChanged: (handler: (state: LabState) => void): (() => void) => subscribe(IpcChannels.LabChanged, handler),
  onDataUpdated: (handler: (payload: DataUpdatedPayload) => void): (() => void) => subscribe(IpcChannels.DataUpdated, handler),
  onLoopStateChanged: (handler: (payload: SessionLoopStatePayload) => void): (() => void) =>
    subscribe(IpcChannels.SessionLoopChanged, handler),
  onPhotosUpdated: (handler: (payload: PhotosUpdatedPayload) => void): (() => void) =>
    subscribe(IpcChannels.PhotosUpdated, handler),
  onExercisesUpdated: (handler: (payload: ExercisesUpdatedPayload) => void): (() => void) =>
    subscribe(IpcChannels.ExercisesUpdated, handler)
}

ipcRenderer.send(IpcChannels.LabViewRegister)
contextBridge.exposeInMainWorld('api', api)
