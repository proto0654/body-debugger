import { app } from 'electron'
import { join } from 'path'

export function getDataDir(): string {
  return join(app.getPath('userData'), 'data')
}

export function getSettingsPath(): string {
  return join(getDataDir(), 'settings.json')
}

export function getProgressPath(): string {
  return join(getDataDir(), 'progress.json')
}

export function getSessionsPath(): string {
  return join(getDataDir(), 'sessions.json')
}
