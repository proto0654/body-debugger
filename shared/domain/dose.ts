import {
  DOSE_BASE_INTERVAL,
  DOSE_EXPONENT,
  INTENSITY_CAP_LONG,
  INTENSITY_CAP_SHORT
} from '../constants/catalog-tuning'
import type { ExerciseReps, ExerciseTimer, Intensity } from '../types/exercise-v2'
import { round5 } from './exercise-v2'

/** Max intensity allowed for a reminder interval (CATALOG-V2 §5). */
export function intensityCap(intervalMinutes: number): Intensity {
  if (intervalMinutes <= INTENSITY_CAP_SHORT) return 2
  if (intervalMinutes < INTENSITY_CAP_LONG) return 3
  return 5
}

export function doseMultiplier(intervalMinutes: number): number {
  const minutes = Math.max(1, intervalMinutes)
  return Math.pow(minutes / DOSE_BASE_INTERVAL, DOSE_EXPONENT)
}

/**
 * Scale the exercise timer by interval; optional personal `scale` from overrides.
 * Result is clamped to [minSec, maxSec] and rounded to 5 s.
 */
export function dose(
  timer: ExerciseTimer,
  intervalMinutes: number,
  scale = 1
): number {
  const raw = timer.defaultSec * Math.max(0.1, scale) * doseMultiplier(intervalMinutes)
  return clamp(timer.minSec, timer.maxSec, round5(raw))
}

export function doseReps(
  reps: ExerciseReps,
  intervalMinutes: number,
  scale = 1
): number {
  const raw = reps.min + (reps.max - reps.min) * Math.min(1, doseMultiplier(intervalMinutes) * Math.max(0.1, scale) / 1.27)
  const value = Math.round(raw)
  return Math.min(reps.max, Math.max(reps.min, value))
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}
