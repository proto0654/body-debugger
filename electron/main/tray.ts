import { app, Menu, Tray, nativeImage } from 'electron'
import type { TrayState } from '../../shared/types/events'
import { createDashboardWindow } from './windows/dashboard'
import { createPopupWindow } from './windows/popup'

let tray: Tray | null = null
let trayState: TrayState = 'idle'

/** Minimal 16×16 emerald PNG (placeholder until character tray icons) */
function createTrayImage(): Electron.NativeImage {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGMQ2Nn4nxLMMGrAqAGjBgwXAwBHHUkf1AtOXwAAAABJRU5ErkJggg=='
  try {
    const img = nativeImage.createFromDataURL(`data:image/png;base64,${pngBase64}`)
    if (!img.isEmpty()) return img
  } catch {
    /* continue */
  }
  return nativeImage.createEmpty()
}

function buildContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Дашборд',
      click: () => {
        createDashboardWindow()
      }
    },
    {
      label: 'Попап (dev)',
      click: () => {
        createPopupWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Пауза',
      enabled: false
    },
    {
      label: 'Настройки',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        app.quit()
      }
    }
  ])
}

export function createAppTray(): Tray {
  if (tray) return tray

  tray = new Tray(createTrayImage())
  tray.setToolTip('Body Debugger')
  tray.setContextMenu(buildContextMenu())
  tray.on('double-click', () => {
    createDashboardWindow()
  })

  return tray
}

export function setTrayState(state: TrayState): void {
  trayState = state
  if (!tray) return
  const labels: Record<TrayState, string> = {
    idle: 'Body Debugger',
    soon: 'Body Debugger — скоро',
    standup: 'Body Debugger — пора встать!',
    success: 'Body Debugger — отлично',
    streak: 'Body Debugger — стрик!'
  }
  tray.setToolTip(labels[state])
  // CSS/pulse animations for tray icons come in a later stage
}

export function getTrayState(): TrayState {
  return trayState
}
