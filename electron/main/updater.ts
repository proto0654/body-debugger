import { app } from 'electron'
import { autoUpdater, type Logger } from 'electron-updater'
import {
  installBlocker,
  shouldCheckForUpdates,
  updateProgressPercent,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_FIRST_CHECK_DELAY_MS,
  type UpdateState
} from '../../shared/domain/update'
import { IpcChannels, type UpdateInstallResult } from '../../shared/types/events'
import { broadcastToWindows } from './broadcast'
import { logError, logInfo, logWarn } from './logger'
import { refreshTrayMenu } from './tray'
import { stopTriggerLoop } from './trigger-loop'
import { getPopupWindow } from './windows/popup'

let state: UpdateState = {
  status: app.isPackaged ? 'idle' : 'disabled',
  currentVersion: app.getVersion(),
  availableVersion: null,
  progressPercent: null,
  checkedAt: null,
  error: null
}

let lastCheckedAt: number | null = null
let firstCheckTimer: NodeJS.Timeout | null = null
let pollTimer: NodeJS.Timeout | null = null
/** A manual check may surface an error; a background check stays silent. */
let manualCheck = false

function publish(next: Partial<UpdateState>): void {
  state = { ...state, ...next }
  broadcastToWindows(IpcChannels.AppUpdateChanged, state)
  refreshTrayMenu()
}

function reportError(): void {
  lastCheckedAt = Date.now()
  if (manualCheck) {
    publish({ status: 'error', progressPercent: null, error: 'Не удалось проверить обновления. Попробуйте позже.' })
    return
  }
  // Offline or a missing feed must not bother anyone; keep a downloaded update ready.
  publish({
    status: state.status === 'ready' ? 'ready' : 'idle',
    progressPercent: state.status === 'ready' ? state.progressPercent : null,
    error: null
  })
}

const updateLogger: Logger = {
  info: (message?: unknown) => logInfo('updater', String(message)),
  warn: (message?: unknown) => logWarn('updater', String(message)),
  error: (message?: unknown) => logError('updater', String(message))
}

/** Called once after `app.whenReady`; a development build never touches the network. */
export function initUpdater(): void {
  if (!app.isPackaged) {
    logInfo('updater', 'disabled: not a packaged build')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = false
  autoUpdater.logger = updateLogger

  autoUpdater.on('checking-for-update', () => {
    publish({ status: 'checking', error: null })
  })
  autoUpdater.on('update-available', (info) => {
    logInfo('updater', `update available: ${info.version}`)
    publish({ status: 'downloading', availableVersion: info.version, progressPercent: 0 })
  })
  autoUpdater.on('update-not-available', () => {
    lastCheckedAt = Date.now()
    publish({
      status: 'current',
      availableVersion: null,
      progressPercent: null,
      checkedAt: new Date().toISOString(),
      error: null
    })
  })
  autoUpdater.on('download-progress', (progress) => {
    publish({ status: 'downloading', progressPercent: updateProgressPercent(progress.transferred, progress.total) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    lastCheckedAt = Date.now()
    logInfo('updater', `update downloaded: ${info.version}`)
    publish({
      status: 'ready',
      availableVersion: info.version,
      progressPercent: 100,
      checkedAt: new Date().toISOString(),
      error: null
    })
  })
  autoUpdater.on('error', (cause) => {
    logError('updater', 'update check failed', cause)
    reportError()
  })

  firstCheckTimer = setTimeout(() => { void checkForUpdates(false) }, UPDATE_FIRST_CHECK_DELAY_MS)
  pollTimer = setInterval(() => { void checkForUpdates(false) }, UPDATE_CHECK_INTERVAL_MS)
}

export function stopUpdater(): void {
  if (firstCheckTimer) clearTimeout(firstCheckTimer)
  if (pollTimer) clearInterval(pollTimer)
  firstCheckTimer = null
  pollTimer = null
}

export function getUpdateState(): UpdateState {
  return state
}

export async function checkForUpdates(manual: boolean): Promise<UpdateState> {
  if (state.status === 'disabled') return state
  if (state.status === 'checking' || state.status === 'downloading') return state
  if (!manual && !shouldCheckForUpdates({ lastCheckedAt, now: Date.now() })) return state

  manualCheck = manual
  publish({ status: 'checking', error: null })
  try {
    await autoUpdater.checkForUpdates()
  } catch (cause) {
    // The 'error' listener already decided whether to surface this.
    logError('updater', 'check request failed', cause)
  } finally {
    manualCheck = false
  }
  return state
}

/**
 * Restart into the downloaded version. An open popup owns the current exercise,
 * so the request is refused and the update installs on the next quit instead.
 */
export function installUpdate(): UpdateInstallResult {
  const popup = getPopupWindow()
  const blocker = installBlocker({
    status: state.status,
    popupOpen: Boolean(popup && !popup.isDestroyed())
  })
  if (blocker) return { started: false, reason: blocker }

  logInfo('updater', `restarting into ${state.availableVersion ?? 'the downloaded version'}`)
  stopTriggerLoop()
  // Persistence writes are synchronous; the reply must reach the renderer first.
  setTimeout(() => { autoUpdater.quitAndInstall(true, true) }, 150)
  return { started: true, reason: null }
}
