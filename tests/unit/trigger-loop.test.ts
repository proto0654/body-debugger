// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultProgress, defaultSettings } from '../../electron/main/persistence/defaults'
import type { AppSettings } from '@shared/types/settings'
import type { Feeling, Session } from '@shared/types/session'
import type { TrayState } from '@shared/types/events'

const mocks = vi.hoisted(() => {
  return {
    settings: { current: null as unknown as AppSettings },
    sessions: { current: [] as Session[] },
    idleSeconds: { current: 0 },
    trayState: { current: 'idle' as TrayState },
    popupClosed: { current: null as (() => void) | null },
    focusPopup: vi.fn(),
    createPopupWindow: vi.fn(),
    getPopupWindow: vi.fn(),
    closePopupWindow: vi.fn(),
    setTrayState: vi.fn((state: TrayState) => {
      mocks.trayState.current = state
    }),
    setTrayPaused: vi.fn(),
    refreshTrayMenu: vi.fn(),
    refreshTrayAnimation: vi.fn(),
    getTrayState: vi.fn(() => mocks.trayState.current),
    broadcastToWindows: vi.fn(),
    notifyDataUpdated: vi.fn(),
    appendSession: vi.fn((session: Session) => {
      mocks.sessions.current = [...mocks.sessions.current, session]
    }),
    applyDoneSession: vi.fn(),
    updateSettings: vi.fn((next: AppSettings) => {
      mocks.settings.current = next
    })
  }
})

vi.mock('electron', () => ({
  powerMonitor: {
    getSystemIdleTime: () => mocks.idleSeconds.current
  }
}))

vi.mock('../../electron/main/broadcast', () => ({
  broadcastToWindows: mocks.broadcastToWindows,
  notifyDataUpdated: mocks.notifyDataUpdated
}))

vi.mock('../../electron/main/persistence', () => ({
  getSettings: () => mocks.settings.current,
  getSnapshot: () => ({
    settings: mocks.settings.current,
    progress: defaultProgress(),
    sessions: mocks.sessions.current
  }),
  appendSession: mocks.appendSession,
  applyDoneSession: mocks.applyDoneSession,
  updateSettings: mocks.updateSettings
}))

vi.mock('../../electron/main/windows/popup', () => ({
  createPopupWindow: mocks.createPopupWindow,
  getPopupWindow: mocks.getPopupWindow,
  closePopupWindow: mocks.closePopupWindow
}))

vi.mock('../../electron/main/tray', () => ({
  setTrayState: mocks.setTrayState,
  setTrayPaused: mocks.setTrayPaused,
  refreshTrayMenu: mocks.refreshTrayMenu,
  refreshTrayAnimation: mocks.refreshTrayAnimation,
  getTrayState: mocks.getTrayState
}))

type Loop = typeof import('../../electron/main/trigger-loop')

/** Fresh module instance: trigger-loop keeps its schedule in module state. */
async function loadLoop(): Promise<Loop> {
  vi.resetModules()
  return import('../../electron/main/trigger-loop')
}

let loop: Loop | null = null

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-30T09:00:00+03:00'))

  mocks.settings.current = defaultSettings()
  mocks.sessions.current = []
  mocks.idleSeconds.current = 0
  mocks.trayState.current = 'idle'
  mocks.popupClosed.current = null
  mocks.createPopupWindow.mockImplementation(() => ({
    once: (event: string, handler: () => void) => {
      if (event === 'closed') mocks.popupClosed.current = handler
    },
    focus: mocks.focusPopup
  }))
  mocks.getPopupWindow.mockImplementation(() => ({ focus: mocks.focusPopup }))
  mocks.appendSession.mockClear()
  mocks.applyDoneSession.mockClear()
  mocks.closePopupWindow.mockClear()
  mocks.broadcastToWindows.mockClear()
  mocks.notifyDataUpdated.mockClear()
  mocks.setTrayPaused.mockClear()
  mocks.refreshTrayMenu.mockClear()
  mocks.refreshTrayAnimation.mockClear()
  mocks.createPopupWindow.mockClear()
  mocks.setTrayState.mockClear()
  mocks.focusPopup.mockClear()
})

afterEach(() => {
  loop?.stopTriggerLoop()
  loop = null
  vi.useRealTimers()
})

describe('trigger loop — manual trigger', () => {
  it('opens one popup and switches the tray to standup', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')

    expect(mocks.createPopupWindow).toHaveBeenCalledTimes(1)
    expect(mocks.setTrayState).toHaveBeenLastCalledWith('standup')
    expect(loop.getActivePopup()?.exercise.id).toBeTruthy()
    expect(loop.getLoopState().nextTriggerAt).toBeNull()
  })

  it('focuses the open popup instead of opening a second one', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    loop.triggerNow('manual')

    expect(mocks.createPopupWindow).toHaveBeenCalledTimes(1)
    expect(mocks.focusPopup).toHaveBeenCalled()
  })
})

describe('trigger loop — session results', () => {
  it('records a done session, bumps the character and schedules the next trigger', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()

    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'done',
      durationSec: 45
    })

    expect(mocks.appendSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', durationSec: 45 })
    )
    expect(mocks.applyDoneSession).toHaveBeenCalledTimes(1)
    expect(mocks.setTrayState).toHaveBeenLastCalledWith('success')
    expect(mocks.notifyDataUpdated).toHaveBeenCalled()

    const next = Date.parse(loop.getLoopState().nextTriggerAt ?? '')
    expect(next - Date.now()).toBe(45 * 60_000)
  })

  it('stores optional details, normalized, with the resolved session', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()

    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'done',
      reps: 12,
      feeling: 4,
      weightKg: 72.55
    })

    expect(mocks.appendSession).toHaveBeenCalledWith(
      expect.objectContaining({ reps: 12, feeling: 4, weightKg: 72.6 })
    )
  })

  it('drops optional details outside the documented ranges', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()

    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'done',
      reps: 0,
      feeling: 9 as Feeling,
      weightKg: 10
    })

    const stored = mocks.appendSession.mock.calls[0]?.[0] as Session
    expect(stored.reps).toBeUndefined()
    expect(stored.feeling).toBeUndefined()
    expect(stored.weightKg).toBeUndefined()
  })

  it('returns the tray to idle after the success blink', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()
    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'done'
    })

    expect(mocks.trayState.current).toBe('success')
    vi.advanceTimersByTime(1_500)
    expect(mocks.trayState.current).toBe('idle')
  })

  it('retries a snoozed session after five minutes', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()
    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'snoozed'
    })

    expect(mocks.setTrayState).toHaveBeenLastCalledWith('soon')
    const next = Date.parse(loop.getLoopState().nextTriggerAt ?? '')
    expect(next - Date.now()).toBe(5 * 60_000)
  })

  it('records a missed session when the popup is left unanswered', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')

    vi.advanceTimersByTime(5 * 60_000)

    expect(mocks.appendSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'missed' })
    )
    expect(mocks.closePopupWindow).toHaveBeenCalled()
    expect(loop.getActivePopup()).toBeNull()
  })

  it('records a skip when the popup closes without an answer', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')

    mocks.popupClosed.current?.()

    expect(mocks.appendSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', skipReason: 'popup-closed' })
    )
    expect(mocks.setTrayState).toHaveBeenLastCalledWith('idle')
  })
})

describe('trigger loop — schedule', () => {
  it('does not trigger while the user is away and restarts after a long break', async () => {
    loop = await loadLoop()
    mocks.idleSeconds.current = 600
    loop.startTriggerLoop()

    vi.advanceTimersByTime(46 * 60_000)
    expect(mocks.createPopupWindow).not.toHaveBeenCalled()

    mocks.idleSeconds.current = 0
    vi.advanceTimersByTime(5_000)

    expect(mocks.createPopupWindow).not.toHaveBeenCalled()
    const next = Date.parse(loop.getLoopState().nextTriggerAt ?? '')
    expect(next).toBeGreaterThan(Date.now())
  })

  it('triggers on the timer once the interval is due', async () => {
    loop = await loadLoop()
    loop.startTriggerLoop()

    vi.advanceTimersByTime(45 * 60_000)

    expect(mocks.createPopupWindow).toHaveBeenCalledTimes(1)
    expect(mocks.setTrayState).toHaveBeenLastCalledWith('standup')
  })

  it('stops the timer while paused but keeps manual triggers alive', async () => {
    loop = await loadLoop()
    loop.startTriggerLoop()

    loop.setPaused(true)
    expect(loop.getLoopState()).toMatchObject({ paused: true, nextTriggerAt: null })

    vi.advanceTimersByTime(2 * 60 * 60_000)
    expect(mocks.createPopupWindow).not.toHaveBeenCalled()

    loop.triggerNow('manual')
    expect(mocks.createPopupWindow).toHaveBeenCalledTimes(1)
  })

  it('reschedules with a grace period after an interval change', async () => {
    loop = await loadLoop()
    loop.startTriggerLoop()

    mocks.settings.current = { ...mocks.settings.current, intervalMinutes: 10 }
    loop.syncLoopFromSettings()

    const next = Date.parse(loop.getLoopState().nextTriggerAt ?? '')
    expect(next - Date.now()).toBeGreaterThanOrEqual(15_000)
    expect(next - Date.now()).toBeLessThanOrEqual(10 * 60_000)
  })
})
