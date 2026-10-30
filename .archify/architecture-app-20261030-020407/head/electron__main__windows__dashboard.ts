import { BrowserWindow } from 'electron'
import { join } from 'path'

let dashboardWindow: BrowserWindow | null = null

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function getDashboardWindow(): BrowserWindow | null {
  return dashboardWindow
}

export function createDashboardWindow(): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show()
    dashboardWindow.focus()
    return dashboardWindow
  }

  dashboardWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#020617',
    title: 'Body Debugger',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  dashboardWindow.on('ready-to-show', () => {
    dashboardWindow?.show()
  })

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    dashboardWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/dashboard`)
  } else {
    dashboardWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/dashboard'
    })
  }

  return dashboardWindow
}
