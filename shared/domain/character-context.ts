import type {
  CharacterBranch,
  CharacterBuild,
  CharacterConditionLevel,
  CharacterEmotion,
  CharacterStage
} from '../types/character'
import type { Session } from '../types/session'
import { characterReaction } from './character-reaction'
import { summarizeSessions } from './character-summary'

/** Portrait overlay for arcade/chronicle preview popups — never live Pinia progress. */
export interface PlaybackCharacterOverlay {
  packId: string
  build: CharacterBuild
  stage: CharacterStage
  branch: CharacterBranch
  condition: CharacterConditionLevel
  emotion: CharacterEmotion
}

/** Stage/branch/condition from the session prefix; emotion from the planned outcome. */
export function playbackCharacterAt(
  sessions: readonly Session[],
  at: Date,
  packId: string,
  build: CharacterBuild,
  session?: Session | null
): PlaybackCharacterOverlay {
  const summary = summarizeSessions(sessions, at)
  const event = !session ? 'ready'
    : session.status === 'missed' ? 'skipped'
      : session.status === 'snoozed' ? 'snoozed'
        : session.status === 'skipped' ? 'skipped'
          : 'done'
  return {
    packId,
    build: build === 'neutral' ? 'average' : build,
    stage: summary.character.stage,
    branch: summary.character.branch,
    condition: summary.condition.level,
    emotion: characterReaction(event).emotion
  }
}

/**
 * A read-only character timeline context. The dashboard and chronicle pass
 * plain objects instead of reading stores directly, so a temporary context can
 * never mutate the real profile.
 */

export interface ManualCharacterState {
  stage: CharacterStage
  branch: CharacterBranch
  build: CharacterBuild
  condition: CharacterConditionLevel
  emotion: CharacterEmotion
}

export interface CharacterContext {
  /** Stable renderer identity; changing it resets the timeline. */
  id: string
  title: string
  sessions: Session[]
  packId: string
  build: CharacterBuild
  allowStart: boolean
  /** Temporary manual preview; null follows the timeline cursor. */
  manual: ManualCharacterState | null
}

/** Starting point for the manual preview: the context's final computed state. */
export function defaultManualState(context: CharacterContext, now: Date): ManualCharacterState {
  const summary = summarizeSessions(context.sessions, now)
  return {
    stage: summary.character.stage,
    branch: summary.character.branch,
    build: context.build === 'neutral' ? 'average' : context.build,
    condition: summary.condition.level,
    emotion: 'neutral'
  }
}
