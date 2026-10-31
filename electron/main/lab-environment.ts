import { app } from 'electron'
import { join } from 'node:path'

export const LAB_ARGUMENT = '--body-debugger-lab'

export function isLabProcess(): boolean {
  return !app.isPackaged && process.argv.includes(LAB_ARGUMENT)
}

/**
 * Development keeps everything on the project drive (E:); a packaged application
 * cannot write next to `resources/app.asar`, so it uses the OS profile instead.
 */
export function getUserDataPath(): string {
  if (app.isPackaged) return app.getPath('userData')
  return join(app.getAppPath(), '.userdata', ...(isLabProcess() ? ['laboratory'] : []))
}
