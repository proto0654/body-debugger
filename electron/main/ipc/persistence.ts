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
import { rememberLabPreferences } from '../laboratory'

export async function getSnapshotRequest(): Promise<ReturnType<typeof getSnapshot>> {
  return getSnapshot()
}

export async function saveSettingsRequest(payload: DataSaveSettingsPayload): Promise<ReturnType<typeof updateSettings>> {
  const snapshot = updateSettings(payload)
  broadcastToWindows(IpcChannels.DataUpdated, snapshot)
  // Interval / pause changes must reach the reminder schedule.
  syncLoopFromSettings()
  rememberLabPreferences()
  return snapshot
}

export async function saveProgressRequest(payload: DataSaveProgressPayload): Promise<ReturnType<typeof updateProgress>> {
  const snapshot = updateProgress(payload)
  rememberLabPreferences()
  broadcastToWindows(IpcChannels.DataUpdated, snapshot)
  return snapshot
}

export async function addWeightRequest(payload: DataAddWeightPayload): Promise<ReturnType<typeof addWeightEntry>> {
  const snapshot = addWeightEntry({ weightKg: payload?.weightKg, at: payload?.at })
  broadcastToWindows(IpcChannels.DataUpdated, snapshot)
  return snapshot
}

export async function removeWeightRequest(payload: DataRemoveWeightPayload): Promise<ReturnType<typeof removeWeightEntry>> {
  const snapshot = removeWeightEntry(payload?.id)
  broadcastToWindows(IpcChannels.DataUpdated, snapshot)
  return snapshot
}

export function registerPersistenceIpc(): void {
  ipcMain.handle(IpcChannels.DataGetSnapshot, () => getSnapshotRequest())

  ipcMain.handle(IpcChannels.DataSaveSettings, (_event, payload: DataSaveSettingsPayload) => saveSettingsRequest(payload))

  ipcMain.handle(IpcChannels.DataSaveProgress, (_event, payload: DataSaveProgressPayload) => saveProgressRequest(payload))

  ipcMain.handle(IpcChannels.DataAddWeight, (_event, payload: DataAddWeightPayload) => addWeightRequest(payload))

  ipcMain.handle(IpcChannels.DataRemoveWeight, (_event, payload: DataRemoveWeightPayload) => removeWeightRequest(payload))
}
