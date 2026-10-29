import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannels,
  type DataAddWeightPayload,
  type DataRemoveWeightPayload,
  type DataSaveProgressPayload,
  type DataSaveSettingsPayload,
  type DataSnapshotPayload,
  type DataUpdatedPayload,
  type SessionLoopStatePayload,
  type SessionPopupPayload,
  type SessionResultPayload,
  type TraySetStatePayload
} from '../../shared/types/events'

const api = {
  openDashboard: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowOpenDashboard),
  openPopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowOpenPopup),
  closePopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowClosePopup),
  resizePopup: (height: number): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.WindowResizePopup, height),
  sessionResult: (payload: SessionResultPayload): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SessionResult, payload),
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
  }
}

contextBridge.exposeInMainWorld('api', api)
