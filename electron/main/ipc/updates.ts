import { ipcMain } from 'electron'
import { IpcChannels, type UpdateInstallResult, type UpdateStatePayload } from '../../../shared/types/events'
import { checkForUpdates, dismissUpdatePrompt, getUpdateState, installUpdate } from '../updater'

export function registerUpdateIpc(): void {
  ipcMain.handle(IpcChannels.AppUpdateState, async (): Promise<UpdateStatePayload> => getUpdateState())

  ipcMain.handle(IpcChannels.AppUpdateCheck, async (): Promise<UpdateStatePayload> => {
    return checkForUpdates(true)
  })

  ipcMain.handle(IpcChannels.AppUpdateInstall, async (): Promise<UpdateInstallResult> => installUpdate())

  ipcMain.handle(IpcChannels.AppUpdateDismiss, async (): Promise<void> => {
    dismissUpdatePrompt()
  })
}
