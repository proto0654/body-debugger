import { app, ipcMain } from 'electron'
import {
  IpcChannels,
  type DebugApplyScenarioPayload
} from '../../../shared/types/events'
import { broadcastToWindows } from '../broadcast'
import { applyDebugState } from '../persistence'
import { syncLoopFromSettings } from '../trigger-loop'

/**
 * Debug / scenario channel (docs/TESTING.md). Registered only in an unpackaged
 * build, so a production renderer cannot replace history even if it asked.
 */
export function isDebugBuild(): boolean {
  return !app.isPackaged
}

export function registerDebugIpc(): void {
  if (!isDebugBuild()) return

  ipcMain.handle(
    IpcChannels.DebugApplyScenario,
    async (_event, payload: DebugApplyScenarioPayload) => {
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
