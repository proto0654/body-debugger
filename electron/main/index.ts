import { app, BrowserWindow } from 'electron'
import { shouldStartHidden } from '../../shared/domain/launch-at-login'
import { APP_IDENTITY } from './app-identity'
import { getUserDataPath, isLabHeadless, isLabProcess } from './lab-environment'
import { initializeLaboratory, stopLaboratory } from './laboratory'
import { registerLabEngineIpc, stopLabEngine } from './lab-engine'
import { startHeadlessLabBridge } from './lab-headless'
import { registerPlaybackCoordinatorIpc } from './playback-coordinator'
import { registerChroniclePlaybackIpc } from './chronicle-playback'
import { createAppTray } from './tray'
import { repaintTrayPortrait } from './tray-portrait'
import { createDashboardWindow } from './windows/dashboard'
import { registerSessionCycleIpc } from './ipc/session-cycle'
import { registerPersistenceIpc } from './ipc/persistence'
import { registerDebugIpc } from './ipc/debug'
import { registerPhotoIpc } from './ipc/photos'
import { loadPhotos } from './photos'
import { loadCustomExercises } from './custom-exercises'
import { registerCustomExerciseIpc } from './ipc/custom-exercises'
import { registerCatalogIpc } from './ipc/catalog'
import { registerLlmIpc } from './ipc/llm'
import { setCatalogOverrides } from './catalog-store'
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
// uses the OS profile. The laboratory engine is routed into its own profile too.
if (!app.isPackaged || isLabProcess()) app.setPath('userData', getUserDataPath())

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
  if (isLabProcess()) return
  if (!shouldStartHidden(argv)) createDashboardWindow()
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
  setCatalogOverrides(getSettings().overrides ?? {})
  registerPhotoProtocol()
  registerPersistenceIpc()
  registerSessionCycleIpc()
  registerPhotoIpc()
  registerCustomExerciseIpc()
  registerCatalogIpc()
  registerLlmIpc()
  registerAppIpc()
  if (isLabProcess()) {
    // The headless sandbox still needs the popup/preview lab IPC.
    registerDebugIpc()
  } else {
    registerLabEngineIpc()
    registerPlaybackCoordinatorIpc()
    registerChroniclePlaybackIpc()
    registerUpdateIpc()
  }

  startTriggerLoop()

  if (isLabProcess()) {
    // No tray or dashboard: the dashboard laboratory tab hosts the only lab UI.
    if (isLabHeadless()) startHeadlessLabBridge()
  } else {
    createAppTray({
      isPaused: () => getSettings().paused,
      isReducedMotion: () => getSettings().reduceMotion,
      onTogglePause: () => setPaused(!getSettings().paused),
      onTriggerNow: () => triggerNow('manual'),
      openDashboard: tab => {
        if (tab) createDashboardWindow({ tab })
        else createDashboardWindow()
      },
      getUpdateReadyVersion: () => {
        const state = getUpdateState()
        return state.status === 'ready' ? state.availableVersion : null
      },
      onInstallUpdate: () => { installUpdate() }
    })
    repaintTrayPortrait()

    // The sandbox never participates in the update feed; only the real app updates.
    initUpdater()

    // Open the dashboard on first launch so Tailwind styles are visible immediately.
    // A login-item launch skips it and starts in the tray.
    if (!startHidden) createDashboardWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow()
    })
  }
})

app.on('will-quit', () => {
  logInfo('app', 'quit')
  stopUpdater()
  stopLabEngine()
  stopLaboratory()
  stopTriggerLoop()
})

app.on('window-all-closed', () => {
  // Stay in tray on all platforms for this app
})
