import type { SeverityLevel } from '../types/settings'
import { canFinish } from './severity'

export const EXERCISE_PREPARATION_MS = 5000
export const EXERCISE_SIDE_SWITCH_MS = 5000

export type ExerciseTimerPhase = 'ready' | 'preparing' | 'first' | 'switching' | 'second' | 'finished'

export interface ExerciseTimerState {
  phase: ExerciseTimerPhase
  remainingMs: number
  workMs: number
  totalMs: number
  perSide: boolean
  progress: number[]
}

/** Duration remains the assigned dose for one side; elapsed=null means not started. */
export function exerciseTimerState(
  durationSec: number,
  perSide: boolean,
  elapsedMs: number | null
): ExerciseTimerState {
  const workMs = Number.isFinite(durationSec) ? Math.max(0, durationSec * 1000) : 0
  const totalMs = EXERCISE_PREPARATION_MS + workMs * (perSide ? 2 : 1)
    + (perSide ? EXERCISE_SIDE_SWITCH_MS : 0)
  const state: ExerciseTimerState = {
    phase: 'ready', remainingMs: workMs, workMs, totalMs, perSide,
    progress: perSide ? [0, 0] : [0]
  }
  if (elapsedMs === null) return state
  const elapsed = Math.max(0, elapsedMs)
  const firstEnd = EXERCISE_PREPARATION_MS + workMs
  const secondStart = firstEnd + EXERCISE_SIDE_SWITCH_MS
  const percent = (remaining: number): number => workMs === 0 ? 100
    : Math.min(100, Math.max(0, (1 - remaining / workMs) * 100))

  if (elapsed < EXERCISE_PREPARATION_MS) {
    state.phase = 'preparing'
    state.remainingMs = EXERCISE_PREPARATION_MS - elapsed
  } else if (elapsed < firstEnd) {
    state.phase = 'first'
    state.remainingMs = firstEnd - elapsed
    state.progress[0] = percent(state.remainingMs)
  } else if (perSide && elapsed < secondStart) {
    state.phase = 'switching'
    state.remainingMs = secondStart - elapsed
    state.progress[0] = 100
  } else if (perSide && elapsed < totalMs) {
    state.phase = 'second'
    state.remainingMs = totalMs - elapsed
    state.progress = [100, percent(state.remainingMs)]
  } else {
    state.phase = 'finished'
    state.remainingMs = 0
    state.progress.fill(100)
  }
  return state
}

export function canFinishExerciseTimer(severity: SeverityLevel, state: ExerciseTimerState): boolean {
  if (state.phase === 'ready') return false
  if (severity === 'soft' || state.phase === 'finished') return true
  const isLastSide = state.phase === (state.perSide ? 'second' : 'first')
  return isLastSide && canFinish(severity, state.remainingMs, state.workMs)
}
