import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { createAppTray } from './tray'
import { createDashboardWindow } from './windows/dashboard'
import { registerSessionCycleIpc } from './ipc/session-cycle'

// Keep Chromium/Electron profile on the project drive (E:), not %APPDATA% on C:
app.setPath('userData', join(app.getAppPath(), '.userdata'))

// Windows: keep app alive in tray when all windows closed
app.setAppUserModelId('com.bodydebugger.app')

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('wm-window-animations-disabled')
}

app.whenReady().then(() => {
  registerSessionCycleIpc()
  createAppTray()

  // Open dashboard on first launch so Tailwind styles are visible immediately
  createDashboardWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboardWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Stay in tray on all platforms for this app
})
