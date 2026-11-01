// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultProgress, defaultSettings } from '../../electron/main/persistence/defaults'
import type { AppSettings } from '@shared/types/settings'
import type { Feeling, Session, SessionStatus } from '@shared/types/session'
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
    }),
    getPhoto: vi.fn((id: string) =>
      id === 'photo-1'
        ? {
            id,
            fileName: `${id}.png`,
            mimeType: 'image/png',
            sizeBytes: 4,
            createdAt: '2026-10-30T06:00:00.000Z',
            sessionId: 'session-1'
          }
        : null
    )
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

vi.mock('../../electron/main/photos', () => ({
  getPhoto: mocks.getPhoto
}))

vi.mock('../../electron/main/tray', () => ({
  setTrayState: mocks.setTrayState,
  setTrayPaused: mocks.setTrayPaused,
  refreshTrayMenu: mocks.refreshTrayMenu,
  refreshTrayAnimation: mocks.refreshTrayAnimation,
  getTrayState: mocks.getTrayState
}))

vi.mock('../../electron/main/tray-portrait', () => ({
  paintTrayPortrait: vi.fn(),
  stopTrayPortrait: vi.fn(),
  repaintTrayPortrait: vi.fn(),
  setTrayPortraitRepaint: vi.fn()
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
  mocks.getPopupWindow.mockImplementation(() =>
    mocks.popupClosed.current ? { focus: mocks.focusPopup } : null
  )
  mocks.closePopupWindow.mockImplementation(() => { mocks.popupClosed.current = null })
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
  it('rejects a result for a different active session', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()!

    expect(loop.handleSessionResult({
      sessionId: 'stale-session', exerciseId: active.exercise.id, status: 'done'
    })).toEqual({ saved: false })
    expect(mocks.appendSession).not.toHaveBeenCalled()
    expect(loop.getActivePopup()?.sessionId).toBe(active.sessionId)
  })

  it('acknowledges a retry without recording or rewarding it twice', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()!
    const payload = { sessionId: active.sessionId, exerciseId: active.exercise.id, status: 'done' as const }

    expect(loop.handleSessionResult(payload)).toEqual({ saved: true })
    expect(loop.handleSessionResult(payload)).toEqual({ saved: true })
    expect(mocks.appendSession).toHaveBeenCalledTimes(1)
    expect(mocks.applyDoneSession).toHaveBeenCalledTimes(1)
    expect(loop.handleSessionResult({ ...payload, status: 'skipped' })).toEqual({ saved: false })
    loop.triggerNow('manual')
    expect(mocks.createPopupWindow).toHaveBeenCalledTimes(1)
  })

  it('rejects an unsolicited result when there is no active session', async () => {
    loop = await loadLoop()
    expect(loop.handleSessionResult({ sessionId: 'invented', exerciseId: 'neck-tilts', status: 'done' }))
      .toEqual({ saved: false })
    expect(mocks.appendSession).not.toHaveBeenCalled()
  })

  it('keeps the active session retryable after a failed disk write', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()!
    mocks.appendSession.mockImplementationOnce(() => { throw new Error('disk full') })

    expect(loop.handleSessionResult({
      sessionId: active.sessionId, exerciseId: active.exercise.id, status: 'done'
    })).toEqual({ saved: false })
    expect(loop.getActivePopup()?.sessionId).toBe(active.sessionId)
    expect(mocks.applyDoneSession).not.toHaveBeenCalled()
    expect(mocks.setTrayState).not.toHaveBeenCalledWith('success')
  })

  it('opens one popup and switches the tray to standup', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')

    expect(mocks.createPopupWindow).toHaveBeenCalledTimes(1)
    expect(mocks.setTrayState).toHaveBeenLastCalledWith('standup')
    expect(loop.getActivePopup()?.exercise.id).toBeTruthy()
    expect(loop.getLoopState().nextTriggerAt).toBeNull()
    expect(loop.getLoopState().countdownAnchorAt).toBeNull()
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
    expect(Date.parse(loop.getLoopState().countdownAnchorAt ?? '')).toBe(Date.now())
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

  it('ignores an unknown status and a negative duration', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()

    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'exploded' as SessionStatus
    })
    expect(mocks.appendSession).not.toHaveBeenCalled()

    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'done',
      durationSec: -30
    })

    const stored = mocks.appendSession.mock.calls[0]?.[0] as Session
    expect(stored.durationSec).toBe(active?.exercise.durationSec)
  })

  it('keeps photo ids that exist in the main photo store', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    const active = loop.getActivePopup()

    loop.handleSessionResult({
      sessionId: active?.sessionId ?? '',
      exerciseId: active?.exercise.id ?? '',
      status: 'done',
      photoIds: ['photo-1', 'missing', 'photo-1']
    })

    const stored = mocks.appendSession.mock.calls[0]?.[0] as Session
    expect(stored.photoIds).toEqual(['photo-1'])
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
    expect(Date.parse(loop.getLoopState().countdownAnchorAt ?? '')).toBe(Date.now())
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

  it('marks chronicle preview popups so the renderer scopes voice rotation', async () => {
    loop = await loadLoop()
    loop.triggerNow('manual')
    expect(loop.getActivePopup()?.preview).toBe(false)

    const live = loop.getActivePopup()!
    expect(loop.handleSessionResult({
      sessionId: live.sessionId, exerciseId: live.exercise.id, status: 'skipped'
    })).toEqual({ saved: true })
    mocks.closePopupWindow()

    loop.setSessionPreviewMode(true)
    loop.triggerNow('manual')
    expect(loop.getActivePopup()?.preview).toBe(true)
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

  it('anchors startup progress at the last session and freezes that fill on pause', async () => {
    const completedAt = new Date(Date.now() - 10 * 60_000).toISOString()
    mocks.sessions.current = [{
      id: 'session-1',
      exerciseId: 'neck',
      status: 'done',
      durationSec: 30,
      triggeredAt: completedAt,
      completedAt
    }]
    loop = await loadLoop()
    loop.startTriggerLoop()

    const state = loop.getLoopState()
    expect(Date.parse(state.countdownAnchorAt ?? '')).toBe(Date.parse(completedAt))
    expect(Date.parse(state.nextTriggerAt ?? '') - Date.parse(completedAt)).toBe(45 * 60_000)

    loop.setPaused(true)
    expect(loop.getLoopState().heldProgress).toBeCloseTo(10 / 45, 5)
    expect(loop.getLoopState().nextTriggerAt).toBeNull()
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
    expect(loop.getLoopState()).toMatchObject({ paused: true, nextTriggerAt: null, heldProgress: 0 })

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
