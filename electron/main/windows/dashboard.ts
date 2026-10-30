import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { IpcChannels } from '../../../shared/types/events'

let dashboardWindow: BrowserWindow | null = null

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function getDashboardWindow(): BrowserWindow | null {
  return dashboardWindow
}

export function createDashboardWindow(tab?: 'settings'): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show()
    dashboardWindow.focus()
    if (tab === 'settings') {
      dashboardWindow.webContents.send(IpcChannels.WindowNavigateDashboard)
    }
    return dashboardWindow
  }

  dashboardWindow = new BrowserWindow({
    width: 960,
    height: Math.min(900, Math.max(480, screen.getPrimaryDisplay().workAreaSize.height - 80)),
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
  dashboardWindow.setMenuBarVisibility(false)

  dashboardWindow.on('ready-to-show', () => {
    dashboardWindow?.show()
  })

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    dashboardWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/dashboard${tab ? '?tab=settings' : ''}`)
  } else {
    dashboardWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: `/dashboard${tab ? '?tab=settings' : ''}`
    })
  }

  return dashboardWindow
}
