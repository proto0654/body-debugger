import { describe, expect, it } from 'vitest'
import {
  TRAY_RING_STEPS,
  TRAY_WARNING_MS,
  ringProgress,
  trayFaceEmotion,
  trayRingColor,
  trayRingFill,
  trayRingPhase,
  trayRingStep,
  trayWaitLabel
} from '../../shared/domain/tray-countdown'

describe('tray countdown ring', () => {
  it('fills from the anchor to the due time and clamps the ends', () => {
    expect(ringProgress(50, 0, 100)).toBe(0.5)
    expect(ringProgress(-10, 0, 100)).toBe(0)
    expect(ringProgress(140, 0, 100)).toBe(1)
    expect(ringProgress(10, 10, 10)).toBe(1)
  })

  it('holds a dim fraction while paused and a full ring while the popup is open', () => {
    expect(trayRingFill({
      now: 50, anchorAt: 0, dueAt: 100, heldProgress: null, paused: false, popupOpen: false
    })).toBe(0.5)
    expect(trayRingFill({
      now: 80, anchorAt: null, dueAt: null, heldProgress: 0.25, paused: true, popupOpen: false
    })).toBe(0.25)
    expect(trayRingFill({
      now: 10, anchorAt: 0, dueAt: 100, heldProgress: 0.25, paused: true, popupOpen: true
    })).toBe(1)
  })

  it('quantizes the ring to a fixed number of steps', () => {
    expect(trayRingStep(0)).toBe(0)
    expect(trayRingStep(0.5)).toBe(TRAY_RING_STEPS / 2)
    expect(trayRingStep(1)).toBe(TRAY_RING_STEPS)
  })

  it('stays green until the warning, then blinks yellow', () => {
    const waiting = { paused: false, popupOpen: false, now: 0, reduceMotion: false }
    expect(trayRingPhase({ ...waiting, dueAt: TRAY_WARNING_MS + 1 })).toBe('green')
    expect(trayRingPhase({ ...waiting, dueAt: TRAY_WARNING_MS })).toBe('blink')
    expect(trayRingPhase({ ...waiting, dueAt: 1_000, reduceMotion: true })).toBe('yellow')
  })

  it('does not blink on pause or while the exercise popup is open', () => {
    expect(trayRingPhase({
      paused: true, popupOpen: false, dueAt: 1_000, now: 0, reduceMotion: false
    })).toBe('paused')
    expect(trayRingPhase({
      paused: false, popupOpen: true, dueAt: 1_000, now: 0, reduceMotion: false
    })).toBe('due')
    expect(trayRingColor('blink', true)).toBe('yellow')
    expect(trayRingColor('blink', false)).toBe('green')
    expect(trayRingColor('paused', true)).toBe('dim')
  })

  it('describes the remaining wait in minutes, seconds, pause and due', () => {
    expect(trayWaitLabel(90_000, 'green')).toBe('через 2 мин')
    expect(trayWaitLabel(60_000, 'green')).toBe('через 1 мин')
    expect(trayWaitLabel(59_000, 'green')).toBe('через 59 сек')
    expect(trayWaitLabel(0, 'blink')).toBe('пора встать')
    expect(trayWaitLabel(5_000, 'paused')).toBe('пауза')
    expect(trayWaitLabel(null, 'due')).toBe('пора встать')
  })

  it('uses the happy face for a success and the tired face while neglected', () => {
    expect(trayFaceEmotion('idle', 0)).toBe('neutral')
    expect(trayFaceEmotion('idle', 2)).toBe('tired')
    expect(trayFaceEmotion('success', 2)).toBe('happy')
  })
})
