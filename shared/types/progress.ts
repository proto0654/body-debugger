import type { CharacterBranch, CharacterBuild, CharacterStage } from './character'

export interface Streak {
  current: number
  max: number
}

export type FocusDirection =
  | 'mobility'
  | 'light_athletics'
  | 'strength'
  | 'body_belts'
  | 'striking'
  | 'balance'

export interface UserFocus {
  primary: FocusDirection | null
  accents: FocusDirection[]
}

/** Levels per exercise id — used by picker and UI */
export type ExerciseLevels = Record<string, number>

export interface UserProgress {
  streak: Streak
  characterStage: CharacterStage
  characterBranch: CharacterBranch
  characterBuild: CharacterBuild
  exerciseLevels: ExerciseLevels
  focus: UserFocus
}
