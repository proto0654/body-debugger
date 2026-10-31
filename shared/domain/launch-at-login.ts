/**
 * Launch-at-login rules shared by the main process and the settings UI.
 *
 * The OS registry is the source of truth: nothing is stored in the JSON
 * profile, so the setting survives reinstalls through Windows itself and cannot
 * drift from Task Manager.
 */

/** Passed by the login item so a startup launch opens the tray, not the dashboard. */
export const LAUNCH_HIDDEN_ARG = '--hidden'

export interface LaunchAtLoginState {
  /** Only an installed Windows build can register a login item. */
  supported: boolean
  /** The login item exists and matches the current executable + hidden argument. */
  enabled: boolean
  /** False when Windows disabled the entry in Task Manager / Startup settings. */
  willLaunch: boolean
}

export function isLaunchAtLoginSupported(input: {
  packaged: boolean
  platform: string
}): boolean {
  return input.packaged && input.platform === 'win32'
}

/** A login-item launch should stay in the tray; a manual launch should show the dashboard. */
export function shouldStartHidden(argv: readonly string[]): boolean {
  return argv.includes(LAUNCH_HIDDEN_ARG)
}
