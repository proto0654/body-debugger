import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { POPUP_BASE_HEIGHT, POPUP_SCREEN_MARGIN, POPUP_WIDTH } from '../../../shared/constants/popup'

let previewWindow: BrowserWindow | null = null

/** Separate visual surface: never participates in the reminder/session loop. */
export function openLabPreviewWindow(onClosed: () => void): void {
  if (previewWindow && !previewWindow.isDestroyed()) { previewWindow.show(); previewWindow.focus(); return }
  const area = screen.getPrimaryDisplay().workArea
  const current = new BrowserWindow({
    width: POPUP_WIDTH, height: POPUP_BASE_HEIGHT, x: area.x + area.width - POPUP_WIDTH - POPUP_SCREEN_MARGIN,
    y: area.y + area.height - POPUP_BASE_HEIGHT - POPUP_SCREEN_MARGIN,
    title: 'Body Debugger · Предпросмотр', frame: false, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, show: false, backgroundColor: '#020617',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  })
  previewWindow = current
  current.once('ready-to-show', () => { if (!current.isDestroyed()) current.show() })
  current.once('closed', () => { if (previewWindow === current) previewWindow = null; onClosed() })
  if (process.env.ELECTRON_RENDERER_URL) void current.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/laboratory-preview`)
  else void current.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/laboratory-preview' })
}

export function closeLabPreviewWindow(): void {
  if (previewWindow && !previewWindow.isDestroyed()) previewWindow.close()
}
