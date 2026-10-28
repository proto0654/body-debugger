/** Strict Exercise schema from CONCEPT.md §8 */

export type ExerciseDifficulty = 1 | 2 | 3 | 4 | 5

export type ExerciseGroup = 'upper' | 'lower' | 'full' | 'equipment'

export interface Exercise {
  id: string
  title: string
  description: string
  durationSec: number
  difficulty: ExerciseDifficulty
  /** Zone / tag used by the picker (e.g. neck, shoulders, hips) */
  category: string
  /** Optional equipment keys; omitted when inventory layer is off */
  equipment?: string[]
  imageKey?: string
  /** Required fallback when no image is available */
  emojiFallback: string
  modificationOf?: string
  /** Optional group for rotation rules — derived or stored */
  group?: ExerciseGroup
}
