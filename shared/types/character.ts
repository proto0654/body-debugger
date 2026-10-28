/** Universal character model from CONCEPT.md §5 */

export type CharacterStage = 0 | 1 | 2 | 3 | 4 | 5

export type CharacterBranch = 'neutral' | 'posture' | 'power' | 'mobility'

export type CharacterBuild = 'lean' | 'average' | 'stocky' | 'neutral'

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
   * Preference order for assets:
   * stage+branch+build → stage+branch → stage → emoji
   */
  candidates: string[]
}
