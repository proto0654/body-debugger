import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { APP_IDENTITY } from '../app-identity'

/**
 * Small always-on-top surface for a background update. It deliberately stays
 * outside the reminder/session loop: it never touches session IPC and never
 * opens while an exercise popup owns the screen.
 */
const WIDTH = 420
const HEIGHT = 232
const SCREEN_MARGIN = 16

let updatePromptWindow: BrowserWindow | null = null
let closedHandler: (() => void) | null = null

export function isUpdatePromptVisible(): boolean {
  return Boolean(
    updatePromptWindow && !updatePromptWindow.isDestroyed() && updatePromptWindow.isVisible()
  )
}

export function hasUpdatePromptWindow(): boolean {
  return Boolean(updatePromptWindow && !updatePromptWindow.isDestroyed())
}

export function showUpdatePrompt(onClosed: () => void): void {
  closedHandler = onClosed
  if (updatePromptWindow && !updatePromptWindow.isDestroyed()) {
    updatePromptWindow.showInactive()
    return
  }

  const area = screen.getPrimaryDisplay().workArea
  const current = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: area.x + area.width - WIDTH - SCREEN_MARGIN,
    y: area.y + area.height - HEIGHT - SCREEN_MARGIN,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // The card paints its own rounded surface; the corners stay transparent.
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: `${APP_IDENTITY.title} · Обновление`,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  updatePromptWindow = current
  current.once('ready-to-show', () => {
    if (!current.isDestroyed()) current.showInactive()
  })
  current.once('closed', () => {
    if (updatePromptWindow === current) updatePromptWindow = null
    const handler = closedHandler
    closedHandler = null
    handler?.()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void current.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/update-prompt`)
  } else {
    void current.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/update-prompt' })
  }
}

export function hideUpdatePrompt(): void {
  if (updatePromptWindow && !updatePromptWindow.isDestroyed()) updatePromptWindow.hide()
}

export function closeUpdatePrompt(): void {
  const current = updatePromptWindow
  if (current && !current.isDestroyed()) current.close()
  updatePromptWindow = null
}
