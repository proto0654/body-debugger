import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import {
  POPUP_BASE_HEIGHT,
  POPUP_EXTRAS_COLLAPSED_HEIGHT,
  POPUP_MAX_HEIGHT,
  POPUP_SCREEN_MARGIN,
  POPUP_WIDTH
} from '../../../shared/constants/popup'
import { getSettings } from '../persistence'

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
  const width = POPUP_WIDTH
  // Reserve room for the collapsed details row so the popup does not jump.
  const settings = getSettings()
  const hasDetails = settings.sessionExtras.enabled || settings.photos.enabled
  const height = hasDetails ? POPUP_EXTRAS_COLLAPSED_HEIGHT : POPUP_BASE_HEIGHT

  popupWindow = new BrowserWindow({
    width,
    height,
    x: sw - width - POPUP_SCREEN_MARGIN,
    y: sh - height - POPUP_SCREEN_MARGIN,
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

/**
 * Resize the popup as its optional details block expands or collapses.
 * The window is anchored to the bottom-right corner, so it grows upwards.
 */
export function resizePopupWindow(height: number): void {
  if (!popupWindow || popupWindow.isDestroyed()) return
  if (typeof height !== 'number' || !Number.isFinite(height)) return

  const next = Math.min(POPUP_MAX_HEIGHT, Math.max(POPUP_BASE_HEIGHT, Math.round(height)))
  const bounds = popupWindow.getBounds()
  const { workArea } = screen.getDisplayMatching(bounds)

  popupWindow.setBounds({
    x: bounds.x,
    y: workArea.y + workArea.height - next - POPUP_SCREEN_MARGIN,
    width: POPUP_WIDTH,
    height: next
  })
}

export function closePopupWindow(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
  }
  popupWindow = null
}
