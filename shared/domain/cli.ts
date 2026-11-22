/**
 * Launch arguments understood by the main process.
 *
 * An external launcher (an Omarchy bar widget) re-launches the AppImage to drive
 * the already-running instance through `second-instance`, so the flags stay small
 * and explicit instead of adding an IPC surface for third-party tools.
 */

/** Show one manual reminder right away. */
export const TRIGGER_NOW_ARG = '--trigger-now'
/** Open (or focus) the dashboard. */
export const OPEN_DASHBOARD_ARG = '--open-dashboard'

export type AppCommand = 'trigger-now' | 'open-dashboard' | null

/** First matching known flag wins; anything else (e.g. `--hidden`) is ignored. */
export function parseAppCommand(argv: readonly string[]): AppCommand {
  for (const arg of argv) {
    if (arg === TRIGGER_NOW_ARG) return 'trigger-now'
    if (arg === OPEN_DASHBOARD_ARG) return 'open-dashboard'
  }
  return null
}
