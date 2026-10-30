import { app, ipcMain } from 'electron'
import {
  IpcChannels,
  type DebugApplyScenarioPayload
} from '../../../shared/types/events'
import { broadcastToWindows } from '../broadcast'
import { applyDebugState } from '../persistence'
import { syncLoopFromSettings } from '../trigger-loop'
import { acknowledgeLabDriver, executeLabCommand, getLabState, launchLaboratory } from '../laboratory'
import { getPopupWindow } from '../windows/popup'
import type { LabDriverAck } from '../../../shared/domain/laboratory-playback'
import { isLabProcess } from '../lab-environment'
import type { LabCommand } from '../../../shared/domain/laboratory'

/**
 * Laboratory launch is available to unpackaged builds. State mutations require
 * the isolated laboratory process; a normal renderer cannot replace history.
 */
export function isDebugBuild(): boolean {
  return !app.isPackaged
}

export function registerDebugIpc(): void {
  if (!isDebugBuild()) return

  ipcMain.handle(IpcChannels.LabOpen, () => launchLaboratory())
  ipcMain.handle(IpcChannels.LabGetState, () => getLabState())
  if (isLabProcess()) ipcMain.handle(IpcChannels.LabDriverAck, (event, ack: LabDriverAck) => {
    if (event.sender !== getPopupWindow()?.webContents) throw new Error('Only the active laboratory popup may acknowledge actions')
    acknowledgeLabDriver(ack)
  })
  let pending: Promise<unknown> = Promise.resolve()
  ipcMain.handle(IpcChannels.LabCommand, (_event, command: LabCommand) => {
    const request = pending.then(() => executeLabCommand(command))
    pending = request.catch(() => undefined)
    return request
  })

  ipcMain.handle(
    IpcChannels.DebugApplyScenario,
    async (_event, payload: DebugApplyScenarioPayload) => {
      if (!isLabProcess()) throw new Error('Open the isolated laboratory first')
      const snapshot = applyDebugState({
        sessions: payload?.sessions,
        settings: payload?.settings,
        progress: payload?.progress
      })
      broadcastToWindows(IpcChannels.DataUpdated, snapshot)
      syncLoopFromSettings()
      return snapshot
    }
  )
}
