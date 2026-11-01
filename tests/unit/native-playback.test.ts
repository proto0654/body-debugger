// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NativePlayback, type NativePlaybackPort } from '../../electron/main/laboratory-playback'
import { ARCADE_SCENE_MS } from '@shared/domain/laboratory-playback'
import { buildLabScenario } from '@shared/domain/laboratory'
import { defaultProgress, defaultSettings } from '../../electron/main/persistence/defaults'
import type { LabDriverCommand } from '@shared/domain/laboratory-playback'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T09:00:00Z')) })
afterEach(() => vi.useRealTimers())

function setup() {
  const plan = buildLabScenario('growth', new Date(), defaultSettings(), defaultProgress())
  let cursor = 1
  let at = Date.parse(plan.events[cursor]!.at)
  let popup = false
  const sent: LabDriverCommand[] = []
  const port: NativePlaybackPort = {
    plan: () => plan, cursor: () => cursor, now: () => at, severity: () => 'medium',
    move: index => { cursor = index },
    clock: (value) => { at = value },
    open: event => { popup = true; return event.session!.id },
    active: () => popup, close: () => { popup = false }, timeout: vi.fn(),
    send: value => sent.push(value), commit: vi.fn((index: number) => { cursor = index }), changed: vi.fn(), intervention: vi.fn()
  }
  const replay = new NativePlayback(port)
  return { replay, port, plan, sent, cursor: () => cursor }
}

/** Idle → gap (cursor jump) → reminder (popup open). */
async function openReminder(replay: NativePlayback): Promise<void> {
  replay.play()
  await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS) // idle → nextEvent → gap
  await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS) // gap → openCurrent → reminder
}

describe('native arcade playback', () => {
  it('never cuts feedback short and waits for the actual window to close after acknowledgement', async () => {
    const { replay, plan, port } = setup()
    const close = vi.spyOn(port, 'close')
    await openReminder(replay)
    const sessionId = replay.state.sessionId!
    replay.resolved({ ...plan.events[2]!.session!, id: sessionId })
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS)
    expect(replay.state.phase).toBe('reaction')
    expect(replay.state.sessionId).toBe(sessionId)
    expect(close).not.toHaveBeenCalled()
    replay.pause()
    replay.acknowledge({ kind: 'feedback-complete', sessionId })
    replay.step()
    expect(replay.state.sessionId).toBe(sessionId)
    port.close()
    replay.play()
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS)
    expect(replay.state.sessionId).not.toBe(sessionId)
    replay.cancel()
  })

  it('jumps the cursor, waits for the popup, then starts without writing history', async () => {
    const { replay, sent, port, cursor } = setup()
    const before = cursor()
    await openReminder(replay)
    expect(replay.state.phase).toBe('reminder')
    expect(cursor()).toBe(before + 1)
    expect(sent).toEqual([])
    replay.acknowledge({ kind: 'ready', sessionId: replay.state.sessionId! })
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS * 2)
    expect(sent.map(value => value.action)).toContain('highlight-start')
    expect(sent.map(value => value.action)).toContain('start')
    expect(port.commit).not.toHaveBeenCalled()
    replay.cancel()
  })

  it('rejects stale acknowledgements after a seek/reset and freezes on pause', async () => {
    const { replay, sent, port } = setup()
    await openReminder(replay)
    const generation = replay.state.generation
    const sessionId = replay.state.sessionId!
    replay.pause()
    const count = sent.length
    await vi.advanceTimersByTimeAsync(600000)
    expect(sent).toHaveLength(count)
    expect(port.clock).toBeDefined()
    replay.cancel()
    replay.acknowledge({ kind: 'applied', generation, sessionId, sequence: 1 })
    expect(replay.state.phase).toBe('idle')
    expect(port.commit).not.toHaveBeenCalled()
  })

  it('resolves a missed reminder through timeout without a laboratory clock', async () => {
    const { replay, plan, port, sent } = setup()
    const missedIndex = 3
    const session = plan.events[missedIndex]!.session!
    plan.events[missedIndex] = {
      ...plan.events[missedIndex]!,
      session: { ...session, status: 'missed' },
      actions: undefined
    }
    port.clock = () => undefined
    port.move(missedIndex - 1)
    await openReminder(replay)
    expect(replay.state.eventIndex).toBe(missedIndex)
    const sessionId = replay.state.sessionId!
    replay.acknowledge({ kind: 'ready', sessionId })
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS * 4)
    expect(port.timeout).toHaveBeenCalled()
    expect(sent.map(value => value.action)).not.toContain('start')
    expect(replay.resolved({ ...session, id: sessionId, status: 'missed' })).toBe(true)
    expect(port.commit).toHaveBeenCalled()
    replay.cancel()
  })

  it('aborts automatic arcade on a manual click instead of waiting for a human', async () => {
    const { replay, port } = setup()
    await openReminder(replay)
    const sessionId = replay.state.sessionId!
    replay.acknowledge({ kind: 'ready', sessionId })
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS)
    replay.acknowledge({ kind: 'manual', sessionId })
    expect(replay.state.phase).toBe('finished')
    expect(replay.playing).toBe(false)
    expect(port.active()).toBe(false)
    expect(port.intervention).toHaveBeenCalled()
  })

  it('skips exercise wall-clock and records only a durable resolution', async () => {
    const { replay, plan, port } = setup()
    await openReminder(replay)
    const sessionId = replay.state.sessionId!
    replay.acknowledge({ kind: 'ready', sessionId })
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS) // highlight-start
    expect(replay.lastCommand!.action).toBe('highlight-start')
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS) // start
    const start = replay.lastCommand!
    expect(start.action).toBe('start')
    replay.acknowledge({ ...start, kind: 'applied' })
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS * 2)
    const done = replay.lastCommand!
    expect(done.action).toBe('done')
    replay.acknowledge({ ...done, kind: 'failed' })
    expect(replay.state.phase).toBe('error')
    expect(port.commit).not.toHaveBeenCalled()
    replay.play()
    await vi.advanceTimersByTimeAsync(ARCADE_SCENE_MS)
    expect(replay.state.sessionId).toBe(sessionId)
    expect(replay.resolved({ ...plan.events[2]!.session!, id: sessionId })).toBe(true)
    expect(port.commit).toHaveBeenCalledOnce()
    expect(replay.state.phase).toBe('saved')
    expect(replay.resolved({ ...plan.events[2]!.session!, id: sessionId })).toBe(false)
    replay.cancel()
  })
})
