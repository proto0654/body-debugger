import { app } from 'electron'
import { join } from 'node:path'
import { resolveAppIdentity } from '../../shared/domain/app-identity'

/**
 * Resolved once per process. The packaged dev build carries the dev
 * productName, so no separate build-time flag is needed.
 */
export const APP_IDENTITY = resolveAppIdentity({
  packaged: app.isPackaged,
  name: app.getName()
})

export const APP_CHANNEL = APP_IDENTITY.channel

/**
 * An unpackaged run uses Electron's own executable icon. Give its dashboard a
 * dev icon so it is distinguishable from the installed production app.
 */
export function windowIconPath(): string | undefined {
  if (app.isPackaged) return undefined
  return join(app.getAppPath(), 'electron', 'resources', 'icon-dev.png')
}
