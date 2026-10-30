import { app, BrowserWindow } from 'electron'
import { getUserDataPath, isLabProcess } from './lab-environment'
import { initializeLaboratory, stopLaboratory } from './laboratory'
import { openLaboratoryWindow } from './windows/laboratory'
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
import { loadPersistence, getSettings } from './persistence'
import { setPaused, startTriggerLoop, stopTriggerLoop, triggerNow } from './trigger-loop'

// Custom scheme for progress photos; must be declared before app is ready.
registerPhotoScheme()

// Keep Chromium/Electron profile on the project drive (E:), not %APPDATA% on C:
app.setPath('userData', getUserDataPath())

if (isLabProcess() && !app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => { if (isLabProcess()) openLaboratoryWindow() })

// Windows: keep app alive in tray when all windows closed
app.setAppUserModelId('com.bodydebugger.app')

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('wm-window-animations-disabled')
}

app.whenReady().then(() => {
  initializeLaboratory()
  loadPersistence()
  loadPhotos()
  loadCustomExercises()
  registerPhotoProtocol()
  registerPersistenceIpc()
  registerSessionCycleIpc()
  registerDebugIpc()
  registerPhotoIpc()
  registerCustomExerciseIpc()

  createAppTray({
    isPaused: () => getSettings().paused,
    isReducedMotion: () => getSettings().reduceMotion,
    onTogglePause: () => setPaused(!getSettings().paused),
    onTriggerNow: () => triggerNow('manual')
  })

  startTriggerLoop()

  // Open dashboard on first launch so Tailwind styles are visible immediately
  createDashboardWindow()
  if (isLabProcess()) openLaboratoryWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboardWindow()
    }
  })
})

app.on('will-quit', () => {
  stopLaboratory()
  stopTriggerLoop()
})

app.on('window-all-closed', () => {
  // Stay in tray on all platforms for this app
})
