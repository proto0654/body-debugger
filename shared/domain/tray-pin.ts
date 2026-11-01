/**
 * "Show next to the clock" is a Windows notification-area preference.
 * The OS stores it per executable; an unpackaged Electron binary is shared
 * by every Electron app, so only an installed build may write it.
 */

export interface TrayPinState {
  supported: boolean
  enabled: boolean
}

export interface NotifyIconEntry {
  /** Subkey name under `HKCU\Control Panel\NotifyIconSettings`. */
  name: string
  executablePath: string | null
  promoted: boolean
}

export function isTrayPinSupported(input: {
  packaged: boolean
  platform: string
  settingsKeyPresent: boolean
}): boolean {
  return input.packaged && input.platform === 'win32' && input.settingsKeyPresent
}

/** Lines are `name<TAB>executablePath<TAB>0|1`, as written by the main process. */
export function parseNotifyIconLines(text: string): NotifyIconEntry[] {
  const entries: NotifyIconEntry[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [name, executablePath, promoted] = trimmed.split('\t')
    if (!name || promoted === undefined) continue
    entries.push({
      name,
      executablePath: executablePath ? executablePath.trim() : null,
      promoted: promoted.trim() === '1'
    })
  }
  return entries
}

export function notifyIconEntryForExe(entries: readonly NotifyIconEntry[], execPath: string): NotifyIconEntry | null {
  const target = normalizePath(execPath)
  return entries.find(entry => entry.executablePath && normalizePath(entry.executablePath) === target) ?? null
}

function normalizePath(path: string): string {
  return path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}
