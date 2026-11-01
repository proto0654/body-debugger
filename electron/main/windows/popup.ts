import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import {
  POPUP_BASE_HEIGHT,
  POPUP_MAX_HEIGHT,
  POPUP_SCREEN_MARGIN,
  POPUP_WIDTH
} from '../../../shared/constants/popup'

let popupWindow: BrowserWindow | null = null

type PopupVisibilityListener = (open: boolean) => void
const visibilityListeners = new Set<PopupVisibilityListener>()

/**
 * The update prompt uses this to stay out of the way while an exercise owns the
 * screen. It is a plain observer; the popup module stays independent of updates.
 */
export function onPopupVisibilityChange(listener: PopupVisibilityListener): () => void {
  visibilityListeners.add(listener)
  return () => {
    visibilityListeners.delete(listener)
  }
}

function notifyPopupVisibility(open: boolean): void {
  visibilityListeners.forEach(listener => {
    try {
      listener(open)
    } catch (cause) {
      console.error('[popup] visibility listener failed', cause)
    }
  })
}

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
  const height = POPUP_BASE_HEIGHT

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
    // The popup card paints itself (index.css `html.window-popup`); the window
    // stays transparent so the rounded corners show the desktop underneath.
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  notifyPopupVisibility(true)

  popupWindow.on('ready-to-show', () => {
    popupWindow?.showInactive()
  })

  popupWindow.on('closed', () => {
    popupWindow = null
    notifyPopupVisibility(false)
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
