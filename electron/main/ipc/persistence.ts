import { ipcMain } from 'electron'
import {
  IpcChannels,
  type DataAddWeightPayload,
  type DataRemoveWeightPayload,
  type DataSaveProgressPayload,
  type DataSaveSettingsPayload
} from '../../../shared/types/events'
import {
  addWeightEntry,
  getSnapshot,
  removeWeightEntry,
  updateProgress,
  updateSettings
} from '../persistence'
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

  ipcMain.handle(IpcChannels.DataAddWeight, async (_event, payload: DataAddWeightPayload) => {
    const snapshot = addWeightEntry({ weightKg: payload?.weightKg, at: payload?.at })
    broadcastToWindows(IpcChannels.DataUpdated, snapshot)
    return snapshot
  })

  ipcMain.handle(IpcChannels.DataRemoveWeight, async (_event, payload: DataRemoveWeightPayload) => {
    const snapshot = removeWeightEntry(payload?.id)
    broadcastToWindows(IpcChannels.DataUpdated, snapshot)
    return snapshot
  })
}
