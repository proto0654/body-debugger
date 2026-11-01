import { app } from 'electron'
import { join } from 'node:path'

export const LAB_ARGUMENT = '--body-debugger-lab'
export const LAB_HEADLESS_ARGUMENT = '--body-debugger-lab-headless'

/**
 * The laboratory runs in its own process with its own profile. Packaged builds
 * may launch it too: the process argument is the boundary that keeps test
 * mutations away from the real profile.
 */
export function isLabProcess(): boolean {
  return process.argv.includes(LAB_ARGUMENT)
}

/** Launched by the playground engine: no tray, dashboard or lab window. */
export function isLabHeadless(): boolean {
  return isLabProcess() && process.argv.includes(LAB_HEADLESS_ARGUMENT)
}

/** Captured before the laboratory redirects `userData`; later reads must not append twice. */
let packagedProfileRoot: string | undefined

function packagedRoot(): string {
  packagedProfileRoot ??= app.getPath('userData')
  return packagedProfileRoot
}

/** The sandbox profile; also used by the parent for lab-photo URLs. */
export function getLaboratoryUserDataPath(): string {
  if (app.isPackaged) return join(packagedRoot(), 'laboratory')
  return join(app.getAppPath(), '.userdata', 'laboratory')
}

/**
 * Development keeps everything on the project drive (E:); a packaged application
 * cannot write next to `resources/app.asar`, so it uses the OS profile instead.
 * The laboratory always gets a separate `laboratory` profile below that root.
 */
export function getUserDataPath(): string {
  if (isLabProcess()) return getLaboratoryUserDataPath()
  if (app.isPackaged) return packagedRoot()
  return join(app.getAppPath(), '.userdata')
}
