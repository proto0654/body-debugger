import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { IpcChannels, type WindowNavigateDashboardPayload } from '../../../shared/types/events'
import { APP_IDENTITY, windowIconPath } from '../app-identity'
import { ensureLabEngine } from '../lab-engine'

export type DashboardTab = 'today' | 'settings'

export interface DashboardWindowOptions {
  tab?: DashboardTab
}

let dashboardWindow: BrowserWindow | null = null

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function getDashboardWindow(): BrowserWindow | null {
  return dashboardWindow
}

function dashboardHash(tab?: DashboardTab): string {
  return tab && tab !== 'today' ? `/dashboard?tab=${tab}` : '/dashboard'
}

export function createDashboardWindow(options: DashboardWindowOptions = {}): BrowserWindow {
  const { tab } = options
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show()
    dashboardWindow.focus()
    if (tab) {
      const payload: WindowNavigateDashboardPayload = { tab }
      dashboardWindow.webContents.send(IpcChannels.WindowNavigateDashboard, payload)
    }
    return dashboardWindow
  }

  const workArea = screen.getPrimaryDisplay().workAreaSize
  const current = new BrowserWindow({
    width: 960,
    height: Math.min(900, Math.max(480, workArea.height - 80)),
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#020617',
    title: APP_IDENTITY.title,
    icon: windowIconPath(),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  dashboardWindow = current
  current.setMenuBarVisibility(false)

  current.on('ready-to-show', () => {
    current.show()
  })

  // Warm the headless sandbox so the first laboratory tab open is near-instant.
  void ensureLabEngine().catch((cause: unknown) => {
    console.error('[dashboard] laboratory engine pre-warm failed', cause)
  })

  current.once('closed', () => {
    if (dashboardWindow === current) dashboardWindow = null
  })

  const hash = dashboardHash(tab)
  if (process.env.ELECTRON_RENDERER_URL) {
    current.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)
  } else {
    current.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }

  return current
}
