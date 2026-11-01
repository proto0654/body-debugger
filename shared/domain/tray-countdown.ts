import type { CharacterEmotion } from '../types/character'
import type { TrayState } from '../types/events'

/** The ring turns yellow this long before the next reminder. */
export const TRAY_WARNING_MS = 20_000

/** How often the warning swaps yellow and green. */
export const TRAY_BLINK_MS = 500

/** Visible steps around the ring. The icon is redrawn when the step changes. */
export const TRAY_RING_STEPS = 32

export type TrayRingPhase = 'green' | 'blink' | 'yellow' | 'paused' | 'due'

export type TrayRingColor = 'green' | 'yellow' | 'dim'

export function ringProgress(now: number, anchor: number, due: number): number {
  const span = due - anchor
  if (!(span > 0)) return 1
  return clamp01((now - anchor) / span)
}

export function trayRingFill(input: {
  now: number
  anchorAt: number | null
  dueAt: number | null
  heldProgress: number | null
  paused: boolean
  popupOpen: boolean
}): number {
  if (input.popupOpen) return 1
  if (input.paused) return clamp01(input.heldProgress ?? 0)
  if (input.anchorAt === null || input.dueAt === null) return 1
  return ringProgress(input.now, input.anchorAt, input.dueAt)
}

export function trayRingStep(progress: number): number {
  return Math.round(clamp01(progress) * TRAY_RING_STEPS)
}

/**
 * Green while waiting, yellow in the last 20 seconds, dim while paused,
 * full and steady while a popup is open.
 */
export function trayRingPhase(input: {
  paused: boolean
  popupOpen: boolean
  dueAt: number | null
  now: number
  reduceMotion: boolean
}): TrayRingPhase {
  if (input.popupOpen) return 'due'
  if (input.paused) return 'paused'
  if (input.dueAt === null) return 'due'
  const remaining = input.dueAt - input.now
  if (remaining <= TRAY_WARNING_MS) return input.reduceMotion ? 'yellow' : 'blink'
  return 'green'
}

export function trayRingColor(phase: TrayRingPhase, blinkOn: boolean): TrayRingColor {
  if (phase === 'paused') return 'dim'
  if (phase === 'yellow') return 'yellow'
  if (phase === 'blink') return blinkOn ? 'yellow' : 'green'
  return 'green'
}

/** Tooltip fragment for the current wait. `null` lets a state label win. */
export function trayWaitLabel(remainingMs: number | null, phase: TrayRingPhase): string | null {
  if (phase === 'paused') return 'пауза'
  if (phase === 'due' || remainingMs === null || remainingMs <= 0) return 'пора встать'
  if (remainingMs >= 60_000) {
    const minutes = Math.ceil(remainingMs / 60_000)
    return `через ${minutes} мин`
  }
  return `через ${Math.ceil(remainingMs / 1000)} сек`
}

/** Happy beats the temporary condition; otherwise a tired face shows neglect. */
export function trayFaceEmotion(trayState: TrayState, conditionLevel: number): CharacterEmotion {
  if (trayState === 'success') return 'happy'
  if (conditionLevel > 0) return 'tired'
  return 'neutral'
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
