import { app, Menu, Tray } from 'electron'
import type { TrayState } from '../../shared/types/events'
import { trayFrameSpec, trayFrames } from './tray-icons'
import { createDashboardWindow } from './windows/dashboard'

/** Main-process actions the tray menu can invoke; wired in `electron/main/index.ts`. */
export interface TrayHandlers {
  isPaused: () => boolean
  isReducedMotion: () => boolean
  onTogglePause: () => void
  onTriggerNow: () => void
}

let tray: Tray | null = null
let trayState: TrayState = 'idle'
let paused = false
let handlers: TrayHandlers | null = null
let frameTimer: NodeJS.Timeout | null = null

const TRAY_LABELS: Record<TrayState, string> = {
  idle: 'Body Debugger',
  soon: 'Body Debugger — скоро',
  standup: 'Body Debugger — пора встать!',
  success: 'Body Debugger — отлично',
  streak: 'Body Debugger — стрик!'
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
      click: () => { createDashboardWindow('settings') }
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

function stopFrameTimer(): void {
  if (frameTimer) clearInterval(frameTimer)
  frameTimer = null
}

/** Show the current state as a static frame or an animation (CONCEPT.md §13). */
function playTrayState(): void {
  stopFrameTimer()
  if (!tray) return

  const spec = trayFrameSpec(trayState)
  const frames = trayFrames(trayState)
  if (frames.length === 0) return

  let index = 0
  tray.setImage(frames[0])

  const animate = spec.intervalMs > 0 && frames.length > 1 && !handlers?.isReducedMotion()
  if (!animate) return

  frameTimer = setInterval(() => {
    if (!tray) {
      stopFrameTimer()
      return
    }
    index += 1
    if (index >= frames.length) {
      if (!spec.loop) {
        stopFrameTimer()
        tray.setImage(frames[frames.length - 1])
        return
      }
      index = 0
    }
    tray.setImage(frames[index])
  }, spec.intervalMs)
}

export function createAppTray(nextHandlers: TrayHandlers): Tray {
  handlers = nextHandlers

  if (tray) {
    refreshTrayMenu()
    playTrayState()
    return tray
  }

  const idle = trayFrames('idle')
  tray = new Tray(idle[0])
  refreshTrayMenu()
  tray.on('double-click', () => {
    createDashboardWindow()
  })
  updateTooltip()
  playTrayState()

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
  playTrayState()
}

/** Re-apply motion settings (e.g. «Уменьшить анимации» toggled on the dashboard). */
export function refreshTrayAnimation(): void {
  playTrayState()
}

export function getTrayState(): TrayState {
  return trayState
}
