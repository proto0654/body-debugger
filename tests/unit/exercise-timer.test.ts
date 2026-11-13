// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canFinishExerciseTimer, exerciseTimerState } from '@shared/domain/exercise-timer'

describe('exercise timer', () => {
  it('waits for an explicit start and includes preparation in the total only', () => {
    expect(exerciseTimerState(40, true, null)).toMatchObject({
      phase: 'ready', remainingMs: 40000, totalMs: 90000, progress: [0, 0]
    })
    expect(exerciseTimerState(40, false, null).totalMs).toBe(45000)
  })

  it.each([
    [0, 'preparing', 5000, [0, 0]],
    [4999, 'preparing', 1, [0, 0]],
    [5000, 'first', 40000, [0, 0]],
    [25000, 'first', 20000, [50, 0]],
    [45000, 'switching', 5000, [100, 0]],
    [49999, 'switching', 1, [100, 0]],
    [50000, 'second', 40000, [100, 0]],
    [70000, 'second', 20000, [100, 50]],
    [90000, 'finished', 0, [100, 100]],
    [200000, 'finished', 0, [100, 100]]
  ])('resolves the two-side timeline at %i ms', (elapsed, phase, remainingMs, progress) => {
    expect(exerciseTimerState(40, true, elapsed)).toMatchObject({ phase, remainingMs, progress })
  })

  it('finishes a single exercise without a side transition', () => {
    expect(exerciseTimerState(30, false, 5000)).toMatchObject({ phase: 'first', progress: [0] })
    expect(exerciseTimerState(30, false, 35000)).toMatchObject({ phase: 'finished', progress: [100] })
  })

  it('unlocks only at 80% of the last working stage on medium and hardcore', () => {
    for (const severity of ['medium', 'hardcore'] as const) {
      for (const elapsed of [null, 0, 44999, 45000, 50000, 81999]) {
        expect(canFinishExerciseTimer(severity, exerciseTimerState(40, true, elapsed))).toBe(false)
      }
      expect(canFinishExerciseTimer(severity, exerciseTimerState(40, true, 82000))).toBe(true)
      expect(canFinishExerciseTimer(severity, exerciseTimerState(30, false, 28999))).toBe(false)
      expect(canFinishExerciseTimer(severity, exerciseTimerState(30, false, 29000))).toBe(true)
    }
  })

  it('allows soft confirmation during preparation but never before start', () => {
    expect(canFinishExerciseTimer('soft', exerciseTimerState(40, true, null))).toBe(false)
    expect(canFinishExerciseTimer('soft', exerciseTimerState(40, true, 0))).toBe(true)
  })

  it('handles a zero-duration laboratory exercise without division by zero', () => {
    const state = exerciseTimerState(0, true, 10000)
    expect(state).toMatchObject({ phase: 'finished', remainingMs: 0, progress: [100, 100] })
    expect(canFinishExerciseTimer('hardcore', state)).toBe(true)
    expect(exerciseTimerState(40, false, -100).phase).toBe('preparing')
  })
})
