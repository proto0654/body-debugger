import { BrowserWindow, ipcMain } from 'electron'
import {
  IpcChannels,
  type DataSaveProgressPayload,
  type DataSaveSettingsPayload,
  type DataUpdatedPayload
} from '../../../shared/types/events'
import { getSnapshot, updateProgress, updateSettings } from '../persistence'

function broadcastDataUpdated(snapshot: DataUpdatedPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.DataUpdated, snapshot)
  }
}

export function registerPersistenceIpc(): void {
  ipcMain.handle(IpcChannels.DataGetSnapshot, async () => getSnapshot())

  ipcMain.handle(IpcChannels.DataSaveSettings, async (_event, payload: DataSaveSettingsPayload) => {
    const snapshot = updateSettings(payload)
    broadcastDataUpdated(snapshot)
    return snapshot
  })

  ipcMain.handle(IpcChannels.DataSaveProgress, async (_event, payload: DataSaveProgressPayload) => {
    const snapshot = updateProgress(payload)
    broadcastDataUpdated(snapshot)
    return snapshot
  })
}

/** Call after main-side writes (e.g. session:result) so renderers re-hydrate. */
export function notifyDataUpdated(): void {
  broadcastDataUpdated(getSnapshot())
}
