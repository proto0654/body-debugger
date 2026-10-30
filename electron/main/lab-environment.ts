import { app } from 'electron'
import { join } from 'node:path'

export const LAB_ARGUMENT = '--body-debugger-lab'

export function isLabProcess(): boolean {
  return !app.isPackaged && process.argv.includes(LAB_ARGUMENT)
}

export function getUserDataPath(): string {
  return join(app.getAppPath(), '.userdata', ...(isLabProcess() ? ['laboratory'] : []))
}
