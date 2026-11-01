// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PLAYBACK_REMINDER_GRACE_MS,
  emptyPlaybackCoordinatorState,
  playbackBlocksReminders
} from '../../shared/domain/playback-coordinator'

const state = vi.hoisted(() => ({
  ipcHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  flush: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      state.ipcHandlers.set(channel, handler)
  }
}))
vi.mock('../../electron/main/broadcast', () => ({
  broadcastToWindows: vi.fn()
}))
vi.mock('../../electron/main/trigger-loop', () => ({
  flushDeferredReminder: state.flush
}))

describe('playback coordinator domain', () => {
  it('blocks reminders while busy and during grace', () => {
    expect(playbackBlocksReminders(emptyPlaybackCoordinatorState(), 1000)).toBe(false)
    expect(playbackBlocksReminders({ owner: 'chronicle', busy: true, graceUntil: null }, 1000)).toBe(true)
    expect(
      playbackBlocksReminders({ owner: null, busy: false, graceUntil: 2000 }, 1500)
    ).toBe(true)
    expect(
      playbackBlocksReminders({ owner: null, busy: false, graceUntil: 2000 }, 2000)
    ).toBe(false)
  })

  it('uses a 30 second post-run grace', () => {
    expect(PLAYBACK_REMINDER_GRACE_MS).toBe(30_000)
  })
})

describe('playback coordinator main', () => {
  beforeEach(() => {
    vi.resetModules()
    state.ipcHandlers.clear()
    state.flush.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stops the previous owner when another begins and starts grace on end', async () => {
    const stopLab = vi.fn()
    const stopChronicle = vi.fn()
    const coordinator = await import('../../electron/main/playback-coordinator')
    coordinator.registerPlaybackStopper('laboratory', stopLab)
    coordinator.registerPlaybackStopper('chronicle', stopChronicle)

    coordinator.beginPlayback('laboratory')
    expect(coordinator.getPlaybackCoordinatorState()).toMatchObject({
      owner: 'laboratory',
      busy: true
    })

    coordinator.beginPlayback('chronicle')
    expect(stopLab).toHaveBeenCalledOnce()
    expect(coordinator.getPlaybackCoordinatorState().owner).toBe('chronicle')

    const ended = coordinator.endPlayback('chronicle')
    expect(ended.busy).toBe(false)
    expect(ended.graceUntil).toBeTypeOf('number')

    await vi.advanceTimersByTimeAsync(PLAYBACK_REMINDER_GRACE_MS + 50)
    expect(state.flush).toHaveBeenCalled()
  })
})
