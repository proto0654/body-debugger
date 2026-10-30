/** Universal character model from CONCEPT.md §5 */

export type CharacterStage = 0 | 1 | 2 | 3 | 4 | 5

export type CharacterBranch = 'neutral' | 'posture' | 'power' | 'mobility'

export type CharacterBuild = 'lean' | 'average' | 'stocky' | 'neutral'

/** Temporary visual neglect, independent of the earned stage and selected build. */
export type CharacterConditionLevel = 0 | 1 | 2 | 3

/** UI-layer emotion; not part of progress calculation */
export type CharacterEmotion =
  | 'neutral'
  | 'focused'
  | 'happy'
  | 'proud'
  | 'tired'
  | 'surprised'

export interface CharacterState {
  stage: CharacterStage
  branch: CharacterBranch
  build: CharacterBuild
  emotion: CharacterEmotion
  /** Active skin / pack id (Desk Hulk by default) */
  packId: string
}

/** Resolved visual lookup key before image resolution */
export interface CharacterVisualKey {
  packId: string
  stage: CharacterStage
  branch: CharacterBranch
  build: CharacterBuild
  emotion: CharacterEmotion
  /**
   * Sprite frame keys, most specific first. The resolver tries them in order and
   * falls back to the emoji. Rules: `shared/domain/character-visual.ts`.
   */
  candidates: string[]
}
