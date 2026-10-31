import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { IpcChannels, type WindowNavigateDashboardPayload } from '../../../shared/types/events'
import { APP_IDENTITY, windowIconPath } from '../app-identity'

export type DashboardTab = 'today' | 'settings' | 'debug'

export interface DashboardWindowOptions {
  tab?: DashboardTab
  /** Wide laboratory shell with its own title; the window lifecycle stays the same. */
  laboratory?: boolean
  onClosed?: () => void
}

let dashboardWindow: BrowserWindow | null = null
let closedHandler: (() => void) | undefined

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function getDashboardWindow(): BrowserWindow | null {
  return dashboardWindow
}

function dashboardHash(tab?: DashboardTab): string {
  return tab && tab !== 'today' ? `/dashboard?tab=${tab}` : '/dashboard'
}

function laboratoryTitle(): string {
  return `${APP_IDENTITY.title} · Лаборатория`
}

export function createDashboardWindow(options: DashboardWindowOptions = {}): BrowserWindow {
  const { tab, laboratory, onClosed } = options
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show()
    dashboardWindow.focus()
    if (laboratory) dashboardWindow.setTitle(laboratoryTitle())
    if (onClosed) closedHandler = onClosed
    if (tab) {
      const payload: WindowNavigateDashboardPayload = { tab }
      dashboardWindow.webContents.send(IpcChannels.WindowNavigateDashboard, payload)
    }
    return dashboardWindow
  }

  const workArea = screen.getPrimaryDisplay().workAreaSize
  const current = new BrowserWindow({
    width: laboratory ? Math.min(1160, workArea.width - 40) : 960,
    height: laboratory ? Math.min(960, workArea.height - 60) : Math.min(900, Math.max(480, workArea.height - 80)),
    minWidth: laboratory ? 700 : 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#020617',
    title: laboratory ? laboratoryTitle() : APP_IDENTITY.title,
    icon: windowIconPath(),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  dashboardWindow = current
  closedHandler = onClosed
  current.setMenuBarVisibility(false)
  if (laboratory) current.on('page-title-updated', event => event.preventDefault())

  current.on('ready-to-show', () => {
    current.show()
  })

  current.once('closed', () => {
    if (dashboardWindow !== current) return
    dashboardWindow = null
    const handler = closedHandler
    closedHandler = undefined
    handler?.()
  })

  const hash = dashboardHash(tab)
  if (process.env.ELECTRON_RENDERER_URL) {
    current.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)
  } else {
    current.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }

  return current
}
