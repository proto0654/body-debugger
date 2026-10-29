import { ipcMain, BrowserWindow } from 'electron'
import {
  IpcChannels,
  type SessionResultPayload,
  type SessionShowPopupPayload,
  type SessionTriggerPayload,
  type SessionUpdatedPayload,
  type TraySetStatePayload
} from '../../../shared/types/events'
import type { Session } from '../../../shared/types/session'
import { createPopupWindow, closePopupWindow, getPopupWindow } from '../windows/popup'
import { createDashboardWindow } from '../windows/dashboard'
import { setTrayState } from '../tray'
import { appendSession, bumpStreakOnDone } from '../persistence'
import { notifyDataUpdated } from './persistence'

/**
 * Session cycle event wiring (CONCEPT.md §2):
 * trigger → tray state → show popup → result → update → tray idle
 *
 * Persistence: session:result appends to history and bumps streak on done.
 */
export function registerSessionCycleIpc(): void {
  ipcMain.handle(IpcChannels.WindowOpenDashboard, async () => {
    createDashboardWindow()
  })

  ipcMain.handle(IpcChannels.WindowOpenPopup, async () => {
    createPopupWindow()
  })

  ipcMain.handle(IpcChannels.WindowClosePopup, async () => {
    closePopupWindow()
  })

  ipcMain.handle(IpcChannels.SessionResult, async (_event, payload: SessionResultPayload) => {
    console.log('[session:result]', payload)

    const completedAt = new Date().toISOString()
    const session: Session = {
      id: payload.sessionId,
      exerciseId: payload.exerciseId,
      status: payload.status,
      durationSec: payload.durationSec ?? 0,
      triggeredAt: completedAt,
      completedAt,
      skipReason: payload.skipReason
    }

    appendSession(session)
    if (payload.status === 'done') {
      bumpStreakOnDone()
    }
    notifyDataUpdated()

    const trayState =
      payload.status === 'done' ? 'success' : payload.status === 'snoozed' ? 'soon' : 'idle'

    setTrayState(trayState)

    const updated: SessionUpdatedPayload = {
      session,
      trayState
    }

    broadcast(IpcChannels.SessionUpdated, updated)

    if (trayState === 'success') {
      setTimeout(() => setTrayState('idle'), 1500)
    }
  })

  ipcMain.on(IpcChannels.TraySetState, (_event, payload: TraySetStatePayload) => {
    setTrayState(payload.state)
  })
}

/** Main-process entry for a trigger (timer / idle / manual). */
export function emitSessionTrigger(payload: SessionTriggerPayload): void {
  console.log('[session:trigger]', payload)
  setTrayState('standup')
  const win = createPopupWindow()

  // Placeholder exercise — real picker runs in renderer/domain later
  const showPayload: SessionShowPopupPayload = {
    sessionId: crypto.randomUUID(),
    exercise: {
      id: 'placeholder-neck-rolls',
      title: 'Круги головой',
      description: 'Медленно покрутите головой — разминка шеи.',
      durationSec: 45,
      difficulty: 1,
      category: 'neck',
      emojiFallback: '🧘'
    }
  }

  win.webContents.once('did-finish-load', () => {
    win.webContents.send(IpcChannels.SessionShowPopup, showPayload)
  })
  // If already loaded (reuse), send immediately
  if (!win.webContents.isLoading()) {
    win.webContents.send(IpcChannels.SessionShowPopup, showPayload)
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
  // Keep popup reference intentional for future targeted sends
  void getPopupWindow
}
