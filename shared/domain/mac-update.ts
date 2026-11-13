/**
 * macOS update install rules. electron-updater downloads the zip; Squirrel.Mac
 * cannot apply an unsigned build, so the main process swaps the .app itself.
 * These helpers decide whether that swap is safe to start.
 */

/** Electron's packaged binary lives at Bundle.app/Contents/MacOS/<name>. */
export function resolveMacAppBundlePath(execPath: string): string | null {
  const normalized = execPath.replace(/\\/g, '/')
  const marker = '.app/Contents/MacOS/'
  const index = normalized.toLowerCase().lastIndexOf(marker.toLowerCase())
  if (index < 0) return null
  const bundle = normalized.slice(0, index + '.app'.length)
  return bundle.endsWith('.app') ? bundle : null
}

/** Gatekeeper App Translocation copies the bundle to a read-only path. */
export function isMacAppTranslocated(appPath: string): boolean {
  return appPath.replace(/\\/g, '/').includes('/AppTranslocation/')
}

export type MacUpdateInstallGate =
  | { ok: true; appPath: string }
  | { ok: false; reason: 'not-bundle' | 'not-relocated' | 'not-writable' }

/**
 * A Mac update can replace the running bundle only when it is a real .app,
 * outside App Translocation, and the parent directory accepts writes
 * (typically /Applications).
 */
export function macUpdateInstallGate(input: {
  execPath: string
  parentWritable: boolean
}): MacUpdateInstallGate {
  const appPath = resolveMacAppBundlePath(input.execPath)
  if (!appPath) return { ok: false, reason: 'not-bundle' }
  if (isMacAppTranslocated(appPath)) return { ok: false, reason: 'not-relocated' }
  if (!input.parentWritable) return { ok: false, reason: 'not-writable' }
  return { ok: true, appPath }
}

/** Russian copy for the update prompt / «О программе» when the swap cannot run. */
export function macUpdateRelocateMessage(): string {
  return 'Перенесите приложение в папку «Программы» и откройте его оттуда, затем обновите снова.'
}
