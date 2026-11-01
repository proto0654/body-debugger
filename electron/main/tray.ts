import { app, Menu, nativeImage, Tray } from 'electron'
import type { NativeImage } from 'electron'
import type { TrayState } from '../../shared/types/events'
import { composeTrayIcon } from '../../shared/domain/tray-icon-bitmap'
import { APP_CHANNEL } from './app-identity'
import { isLabProcess } from './lab-environment'

/** Main-process actions the tray menu can invoke; wired in `electron/main/index.ts`. */
export interface TrayHandlers {
  isPaused: () => boolean
  isReducedMotion: () => boolean
  onTogglePause: () => void
  onTriggerNow: () => void
  /** Open or focus the dashboard; the laboratory process supplies its own shell. */
  openDashboard: (tab?: 'settings') => void
  /** Version of a downloaded update that installs on quit; null when there is none. */
  getUpdateReadyVersion: () => string | null
  onInstallUpdate: () => void
}

let tray: Tray | null = null
let trayState: TrayState = 'idle'
let paused = false
let handlers: TrayHandlers | null = null
/** Countdown fragment such as «через 12 мин». State labels override it. */
let trayDetail: string | null = null

function placeholderImage(): NativeImage {
  const pixels = composeTrayIcon({ size: 16, face: null, progress: 0, color: 'green' })
  return nativeImage.createFromBitmap(Buffer.from(pixels), { width: 16, height: 16, scaleFactor: 1 })
}

function buildContextMenu(): Menu {
  const readyVersion = handlers?.getUpdateReadyVersion() ?? null
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Дашборд',
      click: () => {
        handlers?.openDashboard()
      }
    },
    {
      label: 'Напоминание сейчас',
      click: () => {
        handlers?.onTriggerNow()
      }
    }
  ]

  if (readyVersion) {
    template.push({
      label: `Обновление ${readyVersion} — перезапустить`,
      click: () => {
        handlers?.onInstallUpdate()
      }
    })
  }

  template.push(
    { type: 'separator' },
    {
      label: paused ? 'Продолжить' : 'Пауза',
      click: () => {
        handlers?.onTogglePause()
      }
    },
    {
      label: 'Настройки',
      click: () => { handlers?.openDashboard('settings') }
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        app.quit()
      }
    }
  )

  return Menu.buildFromTemplate(template)
}

function tooltipSuffix(): string | null {
  if (paused) return 'пауза'
  if (trayState === 'success') return 'отлично'
  if (trayState === 'standup') return 'пора встать!'
  return trayDetail
}

function updateTooltip(): void {
  if (!tray) return
  const ready = handlers?.getUpdateReadyVersion() ?? null
  const channel = APP_CHANNEL === 'dev' ? 'Dev · ' : ''
  const laboratory = isLabProcess() ? 'Лаборатория · ' : ''
  const suffix = tooltipSuffix()
  const base = suffix
    ? `${channel}${laboratory}Body Debugger — ${suffix}`
    : `${channel}${laboratory}Body Debugger`
  tray.setToolTip(ready ? `${base} · обновление готово` : base)
}

export function createAppTray(nextHandlers: TrayHandlers): Tray {
  handlers = nextHandlers

  if (tray) {
    refreshTrayMenu()
    updateTooltip()
    return tray
  }

  tray = new Tray(placeholderImage())
  refreshTrayMenu()
  tray.on('double-click', () => {
    handlers?.openDashboard()
  })
  updateTooltip()
  return tray
}

/** Drop the icon and add it again so Windows re-reads the notification setting. */
export function recreateAppTray(): void {
  if (!handlers) return
  const saved = handlers
  tray?.destroy()
  tray = null
  createAppTray(saved)
}

export function hasTray(): boolean {
  return tray !== null
}

export function setTrayImage(image: NativeImage): void {
  tray?.setImage(image)
}

export function setTrayDetail(detail: string | null): void {
  trayDetail = detail
  updateTooltip()
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
}

/** Motion changes are applied by the next portrait paint. */
export function refreshTrayAnimation(): void {
  updateTooltip()
}

export function getTrayState(): TrayState {
  return trayState
}
