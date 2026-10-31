/**
 * Build identity shared by the main process and «О программе».
 *
 * Electron's application name comes from `productName` in the packaged
 * package.json. The dev installer writes `Body Debugger Dev` there, so the same
 * code serves both channels without a separate build-time flag.
 */
export type AppChannel = 'prod' | 'dev'

export interface AppIdentity {
  channel: AppChannel
  /** Windows AppUserModelId; keeps taskbar grouping and login items separate. */
  appId: string
  title: string
}

const PROD_IDENTITY: AppIdentity = {
  channel: 'prod',
  appId: 'com.bodydebugger.app',
  title: 'Body Debugger'
}

const DEV_IDENTITY: AppIdentity = {
  channel: 'dev',
  appId: 'com.bodydebugger.app.dev',
  title: 'Body Debugger Dev'
}

/**
 * An unpackaged run (`npm run dev`) is always a dev build. A packaged app is a
 * dev build only when electron-builder wrote the dev productName into
 * package.json. Keep this suffix in sync with `electron-builder.dev.yml`.
 */
export function resolveAppIdentity(input: { packaged: boolean; name: string }): AppIdentity {
  const isDev = !input.packaged || input.name.trim().endsWith(' Dev')
  return isDev ? DEV_IDENTITY : PROD_IDENTITY
}
