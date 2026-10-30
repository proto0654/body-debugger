import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

let laboratoryWindow: BrowserWindow | null = null

export function openLaboratoryWindow(onClosed?: () => void): void {
  if (laboratoryWindow && !laboratoryWindow.isDestroyed()) {
    laboratoryWindow.show()
    laboratoryWindow.focus()
    return
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  laboratoryWindow = new BrowserWindow({
    width: Math.min(1160, width - 40), height: Math.min(960, height - 60), minWidth: 700, minHeight: 480,
    title: 'Body Debugger · Лаборатория', backgroundColor: '#020617', show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  })
  laboratoryWindow.setMenuBarVisibility(false)
  laboratoryWindow.on('page-title-updated', event => { event.preventDefault() })
  laboratoryWindow.once('ready-to-show', () => laboratoryWindow?.show())
  laboratoryWindow.once('closed', () => { laboratoryWindow = null; onClosed?.() })
  if (process.env.ELECTRON_RENDERER_URL) void laboratoryWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/laboratory`)
  else void laboratoryWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/laboratory' })
}
