/** Character branch from dominant zone × method (CATALOG-V2 §1.2). */

import type { Method, Zone } from '../types/exercise-v2'

export type CharacterBranch = 'posture' | 'power' | 'mobility' | null

export function characterBranch(dominantZone: Zone, method: Method): CharacterBranch {
  if (dominantZone === 'upper') return 'posture'
  if (dominantZone === 'core' && method === 'mobility') return 'posture'
  if (method === 'strength' || method === 'striking') return 'power'
  if (method === 'mobility' || method === 'balance') return 'mobility'
  return null
}

export const BRANCH_LABELS: Record<Exclude<CharacterBranch, null>, string> = {
  posture: 'Осанка',
  power: 'Сила',
  mobility: 'Подвижность'
}
