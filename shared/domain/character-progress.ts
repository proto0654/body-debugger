import { EXERCISE_CATALOG } from '../constants/exercises'
import type {
  CharacterBranch,
  CharacterStage
} from '../types/character'
import type { Exercise } from '../types/exercise'
import type { Session } from '../types/session'

/**
 * Character stage / branch from session history (CONCEPT.md §5).
 *
 * - Stage = cumulative volume of **done** sessions. Thresholds are tunable and
 *   deliberately simple; the character model only stores the resulting number.
 * - Branch = dominant training direction over the last `BRANCH_WINDOW` done
 *   sessions. Every session scores one point for its primary direction, checked
 *   in this order: posture zone (neck / shoulders / upper back / lower back) →
 *   strength or striking → mobility or balance. A weak or tied leader falls
 *   back to `neutral`.
 *
 * Skipped / snoozed / missed sessions never advance the character.
 * Visuals are a separate layer: see `src/components/character/`.
 */

export const STAGE_THRESHOLDS: readonly { stage: CharacterStage; done: number }[] = [
  { stage: 1, done: 3 },
  { stage: 2, done: 8 },
  { stage: 3, done: 20 },
  { stage: 4, done: 45 },
  { stage: 5, done: 80 }
]

export const BRANCH_WINDOW = 30
const MIN_BRANCH_SESSIONS = 3
/** The leader must beat the runner-up by this factor, otherwise the branch stays neutral. */
const BRANCH_LEAD_RATIO = 1.2

const POSTURE_CATEGORIES = new Set(['neck', 'shoulders', 'upperBack', 'lowerBack'])

export interface CharacterProgress {
  stage: CharacterStage
  branch: CharacterBranch
}

/** Stage from the cumulative count of done sessions; shared by stores and the chronicle. */
export function characterStageFor(doneCount: number): CharacterStage {
  let stage: CharacterStage = 0
  for (const step of STAGE_THRESHOLDS) {
    if (doneCount >= step.done) stage = step.stage
  }
  return stage
}

/** UI progress uses the same thresholds as the stored character stage. */
export function characterJourney(sessions: readonly Session[]) {
  const done = sessions.filter((session) => session.status === 'done').length
  const stage = characterStageFor(done)
  const start = STAGE_THRESHOLDS.find((step) => step.stage === stage)?.done ?? 0
  const next = STAGE_THRESHOLDS.find((step) => step.stage > stage)
  return {
    stage,
    done,
    nextStage: next?.stage ?? null,
    remaining: next ? next.done - done : 0,
    ratio: next ? (done - start) / (next.done - start) : 1
  }
}

type BranchTotals = Record<Exclude<CharacterBranch, 'neutral'>, number>

function doneSessions(sessions: readonly Session[]): Session[] {
  return sessions
    .filter((session) => session.status === 'done')
    .sort((a, b) => {
      const aAt = Date.parse(a.completedAt ?? a.triggeredAt)
      const bAt = Date.parse(b.completedAt ?? b.triggeredAt)
      return (Number.isNaN(aAt) ? 0 : aAt) - (Number.isNaN(bAt) ? 0 : bAt)
    })
}

/** Primary training direction of one exercise; `null` means it does not move the branch. */
function branchOf(exercise: Exercise): Exclude<CharacterBranch, 'neutral'> | null {
  if (POSTURE_CATEGORIES.has(exercise.category)) return 'posture'

  const tags = exercise.focus ?? []
  if (tags.includes('strength') || tags.includes('striking')) return 'power'
  if (tags.includes('mobility') || tags.includes('balance')) return 'mobility'
  return null
}

function branchFor(done: Session[], catalogById: Map<string, Exercise>): CharacterBranch {
  const recent = done.slice(-BRANCH_WINDOW)
  const totals: BranchTotals = { posture: 0, power: 0, mobility: 0 }

  for (const session of recent) {
    const exercise = catalogById.get(session.exerciseId)
    if (!exercise) continue
    const branch = branchOf(exercise)
    if (branch) totals[branch] += 1
  }

  const ranked = (Object.entries(totals) as [keyof BranchTotals, number][]).sort(
    (a, b) => b[1] - a[1]
  )
  const [leader, leaderScore] = ranked[0]
  const runnerUpScore = ranked[1][1]

  if (leaderScore < MIN_BRANCH_SESSIONS) return 'neutral'
  if (leaderScore < runnerUpScore * BRANCH_LEAD_RATIO) return 'neutral'
  return leader
}

export function computeCharacterProgress(
  sessions: readonly Session[],
  catalog: Exercise[] = EXERCISE_CATALOG
): CharacterProgress {
  const done = doneSessions(sessions)
  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]))

  return {
    stage: characterStageFor(done.length),
    branch: branchFor(done, catalogById)
  }
}
