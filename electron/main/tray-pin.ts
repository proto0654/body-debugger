import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import {
  notifyIconEntryForExe,
  parseNotifyIconLines,
  type NotifyIconEntry,
  type TrayPinState
} from '../../shared/domain/tray-pin'
import { logError, logInfo } from './logger'
import { recreateAppTray } from './tray'
import { repaintTrayPortrait } from './tray-portrait'

const execFileAsync = promisify(execFile)
const UNSUPPORTED: TrayPinState = { supported: false, enabled: false }

const LIST_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  "$path = 'HKCU:\\Control Panel\\NotifyIconSettings'",
  'if (-not (Test-Path -LiteralPath $path)) { exit 2 }',
  'Get-ChildItem -LiteralPath $path | ForEach-Object {',
  '  $item = Get-ItemProperty -LiteralPath $_.PSPath',
  '  $exe = [string]$item.ExecutablePath',
  '  $promoted = 0',
  '  if ($null -ne $item.IsPromoted) { $promoted = [int]$item.IsPromoted }',
  '  Write-Output ($_.PSChildName + [char]9 + $exe + [char]9 + $promoted)',
  '}'
].join('\n')

const SET_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Set-ItemProperty -LiteralPath $env:BD_TRAY_KEY -Name IsPromoted -Type DWord -Value ([int]$env:BD_TRAY_VALUE)'
].join('\n')

async function listEntries(): Promise<{ present: boolean; entries: NotifyIconEntry[] }> {
  if (process.platform !== 'win32') return { present: false, entries: [] }
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', LIST_SCRIPT],
      { windowsHide: true, timeout: 8_000 }
    )
    return { present: true, entries: parseNotifyIconLines(String(stdout)) }
  } catch (cause) {
    const code = typeof cause === 'object' && cause && 'code' in cause ? cause.code : undefined
    if (code === 2) return { present: false, entries: [] }
    logError('app', 'cannot read notification icon settings', cause)
    return { present: false, entries: [] }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms) })
}

async function writePromoted(name: string, enabled: boolean): Promise<void> {
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', SET_SCRIPT],
    {
      windowsHide: true,
      timeout: 8_000,
      env: {
        ...process.env,
        BD_TRAY_KEY: `HKCU:\\Control Panel\\NotifyIconSettings\\${name}`,
        BD_TRAY_VALUE: enabled ? '1' : '0'
      }
    }
  )
}

/** The registry is the source of truth, same as launch-at-login. */
export async function getTrayPinState(): Promise<TrayPinState> {
  if (!app.isPackaged || process.platform !== 'win32') return UNSUPPORTED
  const listed = await listEntries()
  if (!listed.present) return UNSUPPORTED
  const entry = notifyIconEntryForExe(listed.entries, process.execPath)
  return { supported: true, enabled: entry?.promoted === true }
}

/**
 * Promote or hide this install's tray icon. Windows creates the registry
 * entry only after it has seen the icon, so a missing entry is registered
 * once and then written.
 */
export async function setTrayPinState(enabled: boolean): Promise<TrayPinState> {
  const current = await getTrayPinState()
  if (!current.supported) return current
  try {
    let entry = notifyIconEntryForExe((await listEntries()).entries, process.execPath)
    if (!entry) {
      recreateAppTray()
      repaintTrayPortrait()
      await delay(500)
      entry = notifyIconEntryForExe((await listEntries()).entries, process.execPath)
    }
    if (!entry) {
      logError('app', 'tray pin: Windows has not registered the icon yet')
      return { supported: true, enabled: false }
    }
    if (entry.promoted !== enabled) {
      await writePromoted(entry.name, enabled)
      recreateAppTray()
      repaintTrayPortrait()
    }
    logInfo('app', `tray icon ${enabled ? 'pinned next to the clock' : 'allowed to hide'}`)
  } catch (cause) {
    logError('app', 'cannot change the tray icon visibility', cause)
  }
  return getTrayPinState()
}
