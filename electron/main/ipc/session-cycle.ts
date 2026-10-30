import { ipcMain } from 'electron'
import {
  IpcChannels,
  type SessionResultPayload,
  type TraySetStatePayload
} from '../../../shared/types/events'
import { createDashboardWindow } from '../windows/dashboard'
import { closePopupWindow, getPopupWindow, resizePopupWindow } from '../windows/popup'
import { setTrayState } from '../tray'
import {
  getActivePopup,
  getLoopState,
  handleSessionResult,
  triggerNow
} from '../trigger-loop'

/**
 * Session cycle IPC (CONCEPT.md §2):
 * trigger → popup shows one exercise → result → persistence + tray.
 *
 * The schedule itself lives in `electron/main/trigger-loop.ts`; this module only
 * exposes it to renderers over IPC.
 */
export function registerSessionCycleIpc(): void {
  ipcMain.handle(IpcChannels.WindowOpenDashboard, async () => {
    createDashboardWindow()
  })

  ipcMain.handle(IpcChannels.WindowOpenPopup, async () => {
    triggerNow('manual')
  })

  ipcMain.handle(IpcChannels.WindowClosePopup, async (event) => {
    if (event.sender !== getPopupWindow()?.webContents) return
    closePopupWindow()
  })

  ipcMain.handle(IpcChannels.WindowResizePopup, async (event, height: number) => {
    if (event.sender !== getPopupWindow()?.webContents) return
    resizePopupWindow(height)
  })

  ipcMain.handle(IpcChannels.SessionGetCurrentPopup, async () => getActivePopup())

  ipcMain.handle(IpcChannels.SessionGetLoopState, async () => getLoopState())

  ipcMain.handle(IpcChannels.SessionResult, async (_event, payload: SessionResultPayload) => {
    return handleSessionResult(payload)
  })

  ipcMain.on(IpcChannels.TraySetState, (_event, payload: TraySetStatePayload) => {
    setTrayState(payload.state)
  })
}
