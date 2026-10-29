import { app, Menu, Tray, nativeImage } from 'electron'
import type { TrayState } from '../../shared/types/events'
import { createDashboardWindow } from './windows/dashboard'

/** Main-process actions the tray menu can invoke; wired in `electron/main/index.ts`. */
export interface TrayHandlers {
  isPaused: () => boolean
  onTogglePause: () => void
  onTriggerNow: () => void
}

let tray: Tray | null = null
let trayState: TrayState = 'idle'
let paused = false
let handlers: TrayHandlers | null = null

const TRAY_LABELS: Record<TrayState, string> = {
  idle: 'Body Debugger',
  soon: 'Body Debugger — скоро',
  standup: 'Body Debugger — пора встать!',
  success: 'Body Debugger — отлично',
  streak: 'Body Debugger — стрик!'
}

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
      label: 'Напоминание сейчас',
      click: () => {
        handlers?.onTriggerNow()
      }
    },
    { type: 'separator' },
    {
      label: paused ? 'Продолжить' : 'Пауза',
      click: () => {
        handlers?.onTogglePause()
      }
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

function updateTooltip(): void {
  if (!tray) return
  tray.setToolTip(paused ? 'Body Debugger — пауза' : TRAY_LABELS[trayState])
}

export function createAppTray(nextHandlers: TrayHandlers): Tray {
  handlers = nextHandlers

  if (tray) {
    refreshTrayMenu()
    return tray
  }

  tray = new Tray(createTrayImage())
  refreshTrayMenu()
  tray.on('double-click', () => {
    createDashboardWindow()
  })
  updateTooltip()

  return tray
}

/** Rebuild the menu after pause state changes. */
export function refreshTrayMenu(): void {
  if (!tray) return
  tray.setContextMenu(buildContextMenu())
}

export function setTrayPaused(next: boolean): void {
  paused = next
  updateTooltip()
}

export function setTrayState(state: TrayState): void {
  trayState = state
  updateTooltip()
  // Tray icon animations come in a later stage (CONCEPT §13)
}

export function getTrayState(): TrayState {
  return trayState
}
