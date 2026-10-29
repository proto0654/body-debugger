// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DONE_UNLOCK_RATIO,
  HOLD_CONFIRM_MS,
  canFinish,
  formatCountdown
} from '@shared/domain/severity'

describe('canFinish', () => {
  it('always allows soft severity, even before the timer starts', () => {
    expect(canFinish('soft', 30_000, 30_000)).toBe(true)
    expect(canFinish('soft', 0, 0)).toBe(true)
  })

  it('unlocks medium and hardcore only at the configured share of the timer', () => {
    const duration = 30_000
    const unlockAt = duration * DONE_UNLOCK_RATIO
    expect(canFinish('medium', duration - unlockAt + 1, duration)).toBe(false)
    expect(canFinish('medium', duration - unlockAt, duration)).toBe(true)
    expect(canFinish('hardcore', duration - unlockAt + 1, duration)).toBe(false)
    expect(canFinish('hardcore', duration - unlockAt, duration)).toBe(true)
  })

  it('treats a timer-less exercise as immediately finishable', () => {
    expect(canFinish('medium', 0, 0)).toBe(true)
    expect(canFinish('hardcore', 0, 0)).toBe(true)
  })

  it('clamps a negative remaining time instead of unlocking past 100%', () => {
    expect(canFinish('medium', -5_000, 30_000)).toBe(true)
  })

  it('exposes the hardcore hold duration', () => {
    expect(HOLD_CONFIRM_MS).toBe(1_500)
  })
})

describe('formatCountdown', () => {
  it.each([
    [0, '00:00'],
    [1, '00:01'],
    [999, '00:01'],
    [1_000, '00:01'],
    [59_000, '00:59'],
    [60_000, '01:00'],
    [61_001, '01:02'],
    [3_600_000, '60:00']
  ])('formats %i ms as %s', (remainingMs, expected) => {
    expect(formatCountdown(remainingMs)).toBe(expected)
  })

  it('never shows a negative countdown', () => {
    expect(formatCountdown(-1_000)).toBe('00:00')
  })
})
