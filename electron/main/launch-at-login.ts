import { app } from 'electron'
import {
  LAUNCH_HIDDEN_ARG,
  isLaunchAtLoginSupported,
  type LaunchAtLoginState
} from '../../shared/domain/launch-at-login'
import { APP_IDENTITY } from './app-identity'
import { logError, logInfo } from './logger'

const UNSUPPORTED: LaunchAtLoginState = { supported: false, enabled: false, willLaunch: false }

function supported(): boolean {
  return isLaunchAtLoginSupported({ packaged: app.isPackaged, platform: process.platform })
}

/**
 * Reads the OS-owned login item. The registry value name stays the product
 * title so prod and dev never overwrite each other's autostart entry.
 */
export function getLaunchAtLoginState(): LaunchAtLoginState {
  if (!supported()) return UNSUPPORTED
  try {
    const settings = app.getLoginItemSettings({
      path: process.execPath,
      args: [LAUNCH_HIDDEN_ARG]
    })
    return {
      supported: true,
      enabled: settings.openAtLogin,
      willLaunch: settings.executableWillLaunchAtLogin
    }
  } catch (cause) {
    logError('app', 'cannot read the login item', cause)
    return { supported: true, enabled: false, willLaunch: false }
  }
}

/** Writes the login item and returns the state the OS actually reports. */
export function setLaunchAtLogin(enabled: boolean): LaunchAtLoginState {
  if (!supported()) return UNSUPPORTED
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      enabled,
      path: process.execPath,
      args: [LAUNCH_HIDDEN_ARG],
      name: APP_IDENTITY.title
    })
    logInfo('app', `launch at login ${enabled ? 'enabled' : 'disabled'}`)
  } catch (cause) {
    logError('app', 'cannot change the login item', cause)
  }
  return getLaunchAtLoginState()
}
