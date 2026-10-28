import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

let popupWindow: BrowserWindow | null = null

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function getPopupWindow(): BrowserWindow | null {
  return popupWindow
}

export function createPopupWindow(): BrowserWindow {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.focus()
    return popupWindow
  }

  const display = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = display.workArea
  const width = 320
  const height = 220

  popupWindow = new BrowserWindow({
    width,
    height,
    x: sw - width - 16,
    y: sh - height - 16,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#020617',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  popupWindow.on('ready-to-show', () => {
    popupWindow?.showInactive()
  })

  popupWindow.on('closed', () => {
    popupWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    popupWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/popup`)
  } else {
    popupWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/popup' })
  }

  return popupWindow
}

export function closePopupWindow(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
  }
  popupWindow = null
}
