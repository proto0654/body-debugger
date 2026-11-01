import { ipcMain } from 'electron'
import { IpcChannels } from '../../../shared/types/events'
import { acknowledgeLabDriver, enqueueLabCommand, getLabState } from '../laboratory'
import { getPopupWindow } from '../windows/popup'
import type { LabDriverAck } from '../../../shared/domain/laboratory-playback'
import { isLabProcess } from '../lab-environment'
import type { LabCommand } from '../../../shared/domain/laboratory'

/**
 * Laboratory-only renderer IPC for the native popup and visual preview windows.
 * The playground lab webview uses the lab-engine bridge instead.
 */
export function registerDebugIpc(): void {
  if (!isLabProcess()) return

  ipcMain.handle(IpcChannels.LabGetState, () => getLabState())
  ipcMain.handle(IpcChannels.LabDriverAck, (event, ack: LabDriverAck) => {
    if (event.sender !== getPopupWindow()?.webContents) throw new Error('Only the active laboratory popup may acknowledge actions')
    acknowledgeLabDriver(ack)
  })
  ipcMain.handle(IpcChannels.LabCommand, (_event, command: LabCommand) => enqueueLabCommand(command))
}
