// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NativePlayback, type NativePlaybackPort } from '../../electron/main/laboratory-playback'
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

describe('native semantic playback', () => {
  it('never cuts feedback short and waits for the actual window to close after acknowledgement', () => {
    const { replay, plan, port } = setup()
    const close = vi.spyOn(port, 'close')
    replay.play(500); vi.advanceTimersByTime(700)
    const sessionId = replay.state.sessionId!
    replay.resolved({ ...plan.events[2]!.session!, id: sessionId })
    vi.advanceTimersByTime(3500)
    expect(replay.state.phase).toBe('reaction')
    expect(replay.state.sessionId).toBe(sessionId)
    expect(close).not.toHaveBeenCalled()
    replay.pause()
    replay.acknowledge({ kind: 'feedback-complete', sessionId })
    replay.step()
    expect(replay.state.sessionId).toBe(sessionId)
    port.close()
    replay.play(500); vi.advanceTimersByTime(500)
    expect(replay.state.sessionId).not.toBe(sessionId)
    replay.cancel()
  })

  it('waits for the actual popup, then visibly highlights and starts without writing history', () => {
    const { replay, sent, port } = setup()
    replay.play(500)
    vi.advanceTimersByTime(700)
    expect(replay.state.phase).toBe('reminder')
    expect(sent).toEqual([])
    replay.acknowledge({ kind: 'ready', sessionId: replay.state.sessionId! })
    vi.advanceTimersByTime(1500)
    expect(sent.map(value => value.action)).toContain('highlight-start')
    expect(sent.map(value => value.action)).toContain('start')
    expect(port.commit).not.toHaveBeenCalled()
    replay.cancel()
  })
  it('rejects stale acknowledgements after a seek/reset and freezes on pause', () => {
    const { replay, sent, port } = setup()
    replay.play(500); vi.advanceTimersByTime(700)
    const generation = replay.state.generation
    const sessionId = replay.state.sessionId!
    replay.pause()
    const count = sent.length
    vi.advanceTimersByTime(600000)
    expect(sent).toHaveLength(count)
    expect(port.clock).toBeDefined()
    replay.cancel()
    replay.acknowledge({ kind: 'applied', generation, sessionId, sequence: 1 })
    expect(replay.state.phase).toBe('idle')
    expect(port.commit).not.toHaveBeenCalled()
  })
  it('records only a durable resolution and keeps a failed write retryable with the same identity', () => {
    const { replay, plan, port } = setup()
    replay.play(500); vi.advanceTimersByTime(700)
    const sessionId = replay.state.sessionId!
    replay.acknowledge({ kind: 'ready', sessionId })
    vi.advanceTimersByTime(1500)
    const request = replay.lastCommand!
    replay.acknowledge({ ...request, kind: 'applied' })
    vi.advanceTimersByTime(2000)
    const done = replay.lastCommand!
    expect(done.action).toBe('done')
    replay.acknowledge({ ...done, kind: 'failed' })
    expect(replay.state.phase).toBe('error')
    expect(port.commit).not.toHaveBeenCalled()
    replay.play(500)
    vi.advanceTimersByTime(2000)
    expect(replay.state.sessionId).toBe(sessionId)
    expect(replay.resolved({ ...plan.events[2]!.session!, id: sessionId })).toBe(true)
    expect(port.commit).toHaveBeenCalledOnce()
    expect(replay.state.phase).toBe('saved')
    expect(replay.resolved({ ...plan.events[2]!.session!, id: sessionId })).toBe(false)
    replay.cancel()
  })
})
