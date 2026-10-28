import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannels,
  type SessionResultPayload,
  type SessionShowPopupPayload,
  type TraySetStatePayload
} from '../../shared/types/events'

const api = {
  openDashboard: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowOpenDashboard),
  openPopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowOpenPopup),
  closePopup: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowClosePopup),
  sessionResult: (payload: SessionResultPayload): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SessionResult, payload),
  onShowPopup: (handler: (payload: SessionShowPopupPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SessionShowPopupPayload): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.SessionShowPopup, listener)
    return () => ipcRenderer.removeListener(IpcChannels.SessionShowPopup, listener)
  },
  onTrayState: (handler: (payload: TraySetStatePayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TraySetStatePayload): void => {
      handler(payload)
    }
    ipcRenderer.on(IpcChannels.TraySetState, listener)
    return () => ipcRenderer.removeListener(IpcChannels.TraySetState, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
