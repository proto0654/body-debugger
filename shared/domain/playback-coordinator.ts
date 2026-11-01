/** Who currently owns the single shared NativePlayback / transport. */
export type PlaybackOwner = 'chronicle' | 'laboratory'

/** Grace after a run ends before real timer reminders may fire again. */
export const PLAYBACK_REMINDER_GRACE_MS = 30_000

export interface PlaybackCoordinatorState {
  owner: PlaybackOwner | null
  busy: boolean
  graceUntil: number | null
}

export function emptyPlaybackCoordinatorState(): PlaybackCoordinatorState {
  return { owner: null, busy: false, graceUntil: null }
}

export function playbackBlocksReminders(state: PlaybackCoordinatorState, now: number): boolean {
  if (state.busy) return true
  return state.graceUntil !== null && now < state.graceUntil
}
