import { app, BrowserWindow } from 'electron'
import { shouldStartHidden } from '../../shared/domain/launch-at-login'
import { APP_IDENTITY } from './app-identity'
import { getUserDataPath, isLabProcess } from './lab-environment'
import { initializeLaboratory, openLabDashboard, stopLaboratory, pauseLaboratory } from './laboratory'
import { createAppTray } from './tray'
import { createDashboardWindow } from './windows/dashboard'
import { registerSessionCycleIpc } from './ipc/session-cycle'
import { registerPersistenceIpc } from './ipc/persistence'
import { registerDebugIpc } from './ipc/debug'
import { registerPhotoIpc } from './ipc/photos'
import { loadPhotos } from './photos'
import { loadCustomExercises } from './custom-exercises'
import { registerCustomExerciseIpc } from './ipc/custom-exercises'
import { registerPhotoProtocol, registerPhotoScheme } from './photo-protocol'
import { registerAppIpc } from './ipc/app'
import { registerUpdateIpc } from './ipc/updates'
import { loadPersistence, getSettings } from './persistence'
import { backupDataOnVersionChange } from './persistence/version-backup'
import { getDataDir } from './persistence/paths'
import { setPaused, startTriggerLoop, stopTriggerLoop, triggerNow } from './trigger-loop'
import { getUpdateState, initUpdater, installUpdate, stopUpdater } from './updater'
import { BUILD_COMMIT, BUILD_DATE } from './build-info'
import { initLogging, logInfo } from './logger'

// Custom scheme for progress photos; must be declared before app is ready.
registerPhotoScheme()

// Development keeps the profile on the project drive (E:); a packaged application
// uses the OS profile, because `resources/app.asar` is not writable.
if (!app.isPackaged) app.setPath('userData', getUserDataPath())

const userDataPath = app.getPath('userData')
initLogging(userDataPath)

// A second copy would race the reminder loop and the updater; the laboratory keeps its own lock.
const requiresLock = isLabProcess() || app.isPackaged
// A login-item launch stays in the tray; a manual launch opens the dashboard.
const startHidden = !isLabProcess() && shouldStartHidden(process.argv)
if (requiresLock && !app.requestSingleInstanceLock()) {
  logInfo('app', 'start blocked: another instance owns the lock')
  app.quit()
} else {
  logInfo(
    'app',
    `start version=${app.getVersion()} build=${BUILD_COMMIT} (${BUILD_DATE}) packaged=${app.isPackaged} channel=${APP_IDENTITY.channel} hidden=${startHidden} data=${userDataPath}`
  )
}
app.on('second-instance', (_event, argv) => {
  if (isLabProcess()) openLabDashboard('debug')
  else if (!shouldStartHidden(argv)) createDashboardWindow()
})

// Windows: keep app alive in tray when all windows closed
app.setAppUserModelId(APP_IDENTITY.appId)

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('wm-window-animations-disabled')
}

app.whenReady().then(() => {
  initializeLaboratory()
  // Before any migration or backfill rewrites the stored JSON.
  backupDataOnVersionChange(getDataDir(), app.getVersion())
  loadPersistence()
  loadPhotos()
  loadCustomExercises()
  registerPhotoProtocol()
  registerPersistenceIpc()
  registerSessionCycleIpc()
  registerDebugIpc()
  registerPhotoIpc()
  registerCustomExerciseIpc()
  registerAppIpc()
  registerUpdateIpc()

  createAppTray({
    isPaused: () => getSettings().paused,
    isReducedMotion: () => getSettings().reduceMotion,
    onTogglePause: () => setPaused(!getSettings().paused),
    onTriggerNow: () => triggerNow('manual'),
    openDashboard: tab => {
      if (isLabProcess()) openLabDashboard(tab === 'settings' ? 'settings' : 'today')
      else if (tab) createDashboardWindow({ tab })
      else createDashboardWindow()
    },
    getUpdateReadyVersion: () => {
      const state = getUpdateState()
      return state.status === 'ready' ? state.availableVersion : null
    },
    onInstallUpdate: () => { installUpdate() }
  })

  startTriggerLoop()
  initUpdater()

  // Open the dashboard on first launch so Tailwind styles are visible immediately.
  // A login-item launch skips it and starts in the tray.
  if (isLabProcess()) openLabDashboard('debug')
  else if (!startHidden) createDashboardWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isLabProcess()) openLabDashboard('debug')
      else createDashboardWindow()
    }
  })
})

app.on('will-quit', () => {
  logInfo('app', 'quit')
  stopUpdater()
  stopLaboratory()
  stopTriggerLoop()
})

app.on('window-all-closed', () => {
  // Stay in tray on all platforms for this app
})
