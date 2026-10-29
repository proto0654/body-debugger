import { ipcMain } from 'electron'
import {
  IpcChannels,
  type DataSaveProgressPayload,
  type DataSaveSettingsPayload
} from '../../../shared/types/events'
import { getSnapshot, updateProgress, updateSettings } from '../persistence'
import { broadcastToWindows } from '../broadcast'
import { syncLoopFromSettings } from '../trigger-loop'

export function registerPersistenceIpc(): void {
  ipcMain.handle(IpcChannels.DataGetSnapshot, async () => getSnapshot())

  ipcMain.handle(IpcChannels.DataSaveSettings, async (_event, payload: DataSaveSettingsPayload) => {
    const snapshot = updateSettings(payload)
    broadcastToWindows(IpcChannels.DataUpdated, snapshot)
    // Interval / pause changes must reach the reminder schedule.
    syncLoopFromSettings()
    return snapshot
  })

  ipcMain.handle(IpcChannels.DataSaveProgress, async (_event, payload: DataSaveProgressPayload) => {
    const snapshot = updateProgress(payload)
    broadcastToWindows(IpcChannels.DataUpdated, snapshot)
    return snapshot
  })
}
