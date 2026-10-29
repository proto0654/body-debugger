import { BrowserWindow } from 'electron'
import { IpcChannels, type DataUpdatedPayload } from '../../shared/types/events'
import { getSnapshot } from './persistence'

/** Send a channel payload to every live window (dashboard + popup). */
export function broadcastToWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

/** Push the full main-owned snapshot so renderers re-hydrate. */
export function notifyDataUpdated(): void {
  const snapshot: DataUpdatedPayload = getSnapshot()
  broadcastToWindows(IpcChannels.DataUpdated, snapshot)
}
