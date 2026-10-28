import type { CharacterBranch, CharacterStage } from '@shared/types/character'
import type { Session } from '@shared/types/session'
import type { UserFocus } from '@shared/types/progress'

/**
 * Character stage / branch calculation lives HERE (CONCEPT.md §5).
 *
 * Progress is derived from session data + focus — never from which PNG is loaded.
 * Visual resolution belongs in components/character + assets/character/*.
 *
 * Planned inputs:
 * - done / skipped / missed ratios over a window
 * - streak milestones
 * - focus.primary / accents → branch bias
 * - optional build stays user preference, not auto-calculated
 *
 * Skeleton returns current values unchanged.
 */

export interface CharacterProgressInput {
  sessions: Session[]
  currentStage: CharacterStage
  currentBranch: CharacterBranch
  focus: UserFocus
}

export interface CharacterProgressResult {
  stage: CharacterStage
  branch: CharacterBranch
  stageUp: boolean
}

export function computeCharacterProgress(
  input: CharacterProgressInput
): CharacterProgressResult {
  // TODO: formula from history + focus
  return {
    stage: input.currentStage,
    branch: input.currentBranch,
    stageUp: false
  }
}
