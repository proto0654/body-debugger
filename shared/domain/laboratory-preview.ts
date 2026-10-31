import { CHARACTER_BRANCHES, CHARACTER_BUILDS, CHARACTER_EMOTION_LABELS, CHARACTER_STAGE_LABELS } from '../constants/character'
import { normalizeCharacterPackId } from '../constants/character-packs'
import { CHARACTER_REACTION_EVENTS, CHARACTER_REACTION_LABELS, type CharacterReactionEvent } from './character-reaction'
import type { CharacterBranch, CharacterBuild, CharacterConditionLevel, CharacterEmotion, CharacterStage } from '../types/character'

export const LAB_POPUP_STATES = [...CHARACTER_REACTION_EVENTS, 'error'] as const
export type LabPopupState = CharacterReactionEvent | 'error'
export const LAB_POPUP_LABELS: Record<LabPopupState, string> = { ...CHARACTER_REACTION_LABELS, error: 'Ошибка сохранения' }

/** Runtime-only visual overrides. No sessions or earned progress are written. */
export interface LabVisualPreview {
  packId: string
  stage: CharacterStage
  build: CharacterBuild
  branch: CharacterBranch
  condition: CharacterConditionLevel
  emotion: CharacterEmotion
  popup: LabPopupState
  sequence: number
}

export function validateLabVisualPreview(raw: unknown): LabVisualPreview {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid visual preview')
  const value = raw as LabVisualPreview
  if (normalizeCharacterPackId(value.packId) !== value.packId
    || !Object.prototype.hasOwnProperty.call(CHARACTER_STAGE_LABELS, value.stage) || !Number.isInteger(value.stage)
    || !CHARACTER_BUILDS.includes(value.build) || !CHARACTER_BRANCHES.includes(value.branch)
    || typeof value.emotion !== 'string' || !Object.prototype.hasOwnProperty.call(CHARACTER_EMOTION_LABELS, value.emotion)
    || ![0, 1, 2, 3].includes(value.condition)
    || !LAB_POPUP_STATES.includes(value.popup)
    || !Number.isSafeInteger(value.sequence) || value.sequence < 0) throw new Error('Invalid visual preview')
  return { packId: value.packId, stage: value.stage, build: value.build, branch: value.branch,
    condition: value.condition, emotion: value.emotion, popup: value.popup, sequence: value.sequence }
}
