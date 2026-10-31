import type { CharacterReactionEvent } from './character-reaction'

/** Reading time is real time, independent of laboratory speed and motion preferences. */
export const REACTION_TIMING_MS = { done: 4500, milestone: 6000, quiet: 2500, exit: 180 } as const

export function reactionDuration(event: CharacterReactionEvent): number {
  if (event === 'stage-up' || event === 'streak') return REACTION_TIMING_MS.milestone
  if (event === 'skipped' || event === 'snoozed') return REACTION_TIMING_MS.quiet
  return REACTION_TIMING_MS.done
}
