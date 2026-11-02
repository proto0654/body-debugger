import { ipcMain } from 'electron'
import {
  IpcChannels,
  type LlmChangedPayload,
  type LlmPreviewRequestPayload,
  type LlmRunPayload,
  type LlmSaveConfigPayload,
  type LlmSetKeyPayload,
  type LlmToggleOpPayload
} from '../../../shared/types/events'
import { broadcastToWindows } from '../broadcast'
import type { Changeset } from '../../../shared/domain/changeset'
import { broadcastCatalogUpdated } from './catalog'
import { clearKey, setKey } from '../llm/secrets'
import {
  applyChangeset,
  cancelRun,
  discardChangeset,
  getChangesetById,
  getLlmConfig,
  previewRequest,
  revertChangeset,
  runRequest,
  saveLlmConfig,
  setLlmChangedHook,
  testConnection,
  toggleOp
} from '../llm/orchestrator'

function broadcastChangeset(changeset: Changeset): void {
  const payload: LlmChangedPayload = { changeset }
  broadcastToWindows(IpcChannels.LlmChanged, payload)
}

export function registerLlmIpc(): void {
  setLlmChangedHook(broadcastChangeset)

  ipcMain.handle(IpcChannels.LlmGetConfig, () => getLlmConfig())

  ipcMain.handle(IpcChannels.LlmSaveConfig, (_event, payload: LlmSaveConfigPayload) => {
    const llm = saveLlmConfig(payload?.llm ?? {})
    return { llm, hasKey: getLlmConfig().hasKey }
  })

  ipcMain.handle(IpcChannels.LlmSetKey, (_event, payload: LlmSetKeyPayload) => {
    if (!payload?.key || !payload.key.trim()) clearKey()
    else setKey(payload.key)
    return getLlmConfig()
  })

  ipcMain.handle(IpcChannels.LlmTest, () => testConnection())

  ipcMain.handle(IpcChannels.LlmPreviewRequest, (_event, payload: LlmPreviewRequestPayload) =>
    previewRequest(payload)
  )

  ipcMain.handle(IpcChannels.LlmRun, async (_event, payload: LlmRunPayload) => runRequest(payload))

  ipcMain.handle(IpcChannels.LlmCancel, () => ({ cancelled: cancelRun() }))

  ipcMain.handle(IpcChannels.LlmGetChangeset, (_event, id: string) => getChangesetById(id))

  ipcMain.handle(IpcChannels.LlmToggleOp, (_event, payload: LlmToggleOpPayload) =>
    toggleOp(payload.changesetId, payload.index, payload.enabled)
  )

  ipcMain.handle(IpcChannels.LlmApply, (_event, changesetId: string) => {
    const changeset = applyChangeset(changesetId)
    if (changeset) broadcastCatalogUpdated()
    return changeset
  })

  ipcMain.handle(IpcChannels.LlmDiscard, (_event, changesetId: string) => discardChangeset(changesetId))

  ipcMain.handle(IpcChannels.LlmRevert, (_event, changesetId: string) => {
    const changeset = revertChangeset(changesetId)
    if (changeset) broadcastCatalogUpdated()
    return changeset
  })
}
