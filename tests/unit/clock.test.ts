// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLaboratoryClock, nowDate, nowMs, setLaboratoryClock } from '@shared/domain/clock'
import { computeStreak } from '@shared/domain/streak'
import { makeSession } from '../fixtures'

afterEach(() => { setLaboratoryClock(); vi.useRealTimers() })

describe('laboratory app clock', () => {
  it('uses the real clock outside the laboratory', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T09:00:00Z'))
    expect(nowMs()).toBe(Date.now())
    expect(getLaboratoryClock()).toBeUndefined()
  })
  it('freezes calendar time without freezing UI timers and can run from a virtual anchor', () => {
    vi.useFakeTimers()
    const at = '2026-01-01T09:00:00.000Z'
    setLaboratoryClock({ at, running: false, silent: true })
    const animation = vi.fn()
    setTimeout(animation, 1000)
    vi.advanceTimersByTime(1000)
    expect(animation).toHaveBeenCalledOnce()
    expect(nowDate().toISOString()).toBe(at)
    setLaboratoryClock({ at, running: true, silent: false })
    vi.advanceTimersByTime(1500)
    expect(getLaboratoryClock()).toEqual({ at: '2026-01-01T09:00:01.500Z', running: true, silent: false })
  })
  it('expires day-based rules according to laboratory time rather than Windows time', () => {
    const session = makeSession({ exerciseId: 'neck-tilts', triggeredAt: new Date(2026, 0, 1, 9).toISOString() })
    setLaboratoryClock({ at: new Date(2026, 0, 1, 12).toISOString(), running: false, silent: true })
    expect(computeStreak([session]).current).toBe(1)
    setLaboratoryClock({ at: new Date(2026, 0, 3, 12).toISOString(), running: false, silent: true })
    expect(computeStreak([session]).current).toBe(0)
  })
  it('rejects invalid virtual timestamps', () => {
    expect(() => setLaboratoryClock({ at: 'bad', running: false, silent: true })).toThrow()
  })
  it('scales only application time and preserves its anchor while paused', () => {
    vi.useFakeTimers()
    setLaboratoryClock({ at: '2026-01-01T09:00:00Z', running: true, silent: false, rate: 50 })
    vi.advanceTimersByTime(500)
    expect(nowDate().toISOString()).toBe('2026-01-01T09:00:25.000Z')
    setLaboratoryClock({ ...getLaboratoryClock()!, running: false })
    vi.advanceTimersByTime(300000)
    expect(nowDate().toISOString()).toBe('2026-01-01T09:00:25.000Z')
    expect(() => setLaboratoryClock({ at: '2026-01-01T09:00:00Z', running: true, silent: false, rate: Infinity })).toThrow()
  })
})
