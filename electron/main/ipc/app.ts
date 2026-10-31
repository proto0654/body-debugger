import { app, ipcMain, shell } from 'electron'
import { IpcChannels, type AppInfoPayload } from '../../../shared/types/events'
import type { LaunchAtLoginState } from '../../../shared/domain/launch-at-login'
import { APP_IDENTITY } from '../app-identity'
import { BUILD_COMMIT, BUILD_DATE } from '../build-info'
import { getUserDataPath } from '../lab-environment'
import { getLaunchAtLoginState, setLaunchAtLogin } from '../launch-at-login'
import { getLogDir, logError } from '../logger'

export function registerAppIpc(): void {
  ipcMain.handle(IpcChannels.AppGetInfo, async (): Promise<AppInfoPayload> => ({
    version: app.getVersion(),
    buildCommit: BUILD_COMMIT,
    buildDate: BUILD_DATE,
    packaged: app.isPackaged,
    channel: APP_IDENTITY.channel,
    platform: process.platform,
    dataPath: getUserDataPath(),
    logDir: getLogDir()
  }))

  ipcMain.handle(IpcChannels.AppOpenLogs, async (): Promise<boolean> => {
    const dir = getLogDir()
    if (!dir) return false
    const failure = await shell.openPath(dir)
    if (failure) logError('app', `cannot open the log directory: ${failure}`)
    return failure === ''
  })

  ipcMain.handle(IpcChannels.AppGetLaunchAtLogin, async (): Promise<LaunchAtLoginState> => {
    return getLaunchAtLoginState()
  })

  ipcMain.handle(
    IpcChannels.AppSetLaunchAtLogin,
    async (_event, enabled: unknown): Promise<LaunchAtLoginState> => {
      if (typeof enabled !== 'boolean') {
        logError('app', 'launch-at-login received a non-boolean value')
        return getLaunchAtLoginState()
      }
      return setLaunchAtLogin(enabled)
    }
  )
}
