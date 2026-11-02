import { ipcMain } from 'electron'
import {
  IpcChannels,
  type CatalogListPayload,
  type CatalogRenameBatchPayload,
  type CatalogSetBatchEnabledPayload,
  type CatalogSetStatusPayload,
  type CatalogUpdatedPayload
} from '../../../shared/types/events'
import { broadcastToWindows } from '../broadcast'
import {
  getCatalogFile,
  getResolvedCatalogV2,
  renameBatch,
  setBatchEnabled,
  setExerciseStatus
} from '../catalog-store'

export function catalogListPayload(): CatalogListPayload {
  return {
    catalog: getCatalogFile(),
    resolvedCount: getResolvedCatalogV2().length
  }
}

export function broadcastCatalogUpdated(): void {
  const payload: CatalogUpdatedPayload = { catalog: getCatalogFile() }
  broadcastToWindows(IpcChannels.CatalogUpdated, payload)
}

export function registerCatalogIpc(): void {
  ipcMain.handle(IpcChannels.CatalogList, () => catalogListPayload())

  ipcMain.handle(IpcChannels.CatalogSetStatus, (_event, payload: CatalogSetStatusPayload) => {
    const ok = setExerciseStatus(payload.id, payload.status)
    if (ok) broadcastCatalogUpdated()
    return { ok, ...catalogListPayload() }
  })

  ipcMain.handle(IpcChannels.CatalogSetBatchEnabled, (_event, payload: CatalogSetBatchEnabledPayload) => {
    const ok = setBatchEnabled(payload.id, payload.enabled)
    if (ok) broadcastCatalogUpdated()
    return { ok, ...catalogListPayload() }
  })

  ipcMain.handle(IpcChannels.CatalogRenameBatch, (_event, payload: CatalogRenameBatchPayload) => {
    const ok = renameBatch(payload.id, payload.name)
    if (ok) broadcastCatalogUpdated()
    return { ok, ...catalogListPayload() }
  })
}
