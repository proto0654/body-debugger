import { nowDate } from './clock'
import { EXERCISE_CATALOG, FALLBACK_EXERCISE } from '../constants/exercises'
import type { Exercise, ExerciseGroup } from '../types/exercise'
import type { Session } from '../types/session'
import type { AppSettings, ExercisePickerMode } from '../types/settings'
import type { UserFocus } from '../types/progress'

/**
 * Weighted exercise picker (CONCEPT.md §7).
 *
 * Rules, all multiplicative so they compose and stay explainable:
 * - penalty for the category / group of the previous *done* session;
 * - penalty for categories and groups already done today;
 * - bonus for neglected categories (grows with days since last use, caps at a week);
 * - bonus for the user's Focus (primary > accents);
 * - inventory gate: equipment exercises need the layer on and the item owned;
 * - modes: balance (default), rotation (avoids the previous category),
 *   focus (pushes preferences), push (drives the most neglected category).
 *
 * Skipped / snoozed / missed sessions do not count as training.
 * Difficulty and personal exercise levels are intentionally not weighted yet —
 * they land with stage/severity work (ROADMAP #4–#5).
 */

const DAY_MS = 86_400_000
const NEGLECT_DAYS = 7
const MIN_ROTATION_CANDIDATES = 3

interface ModeTuning {
  previousCategory: number
  previousGroup: number
  todayCategory: number
  todayGroup: number
  neglectMax: number
  focusPrimary: number
  focusAccent: number
  avoidPreviousCategory: boolean
  pushLagging: number
  pushOthers: number
}

const TUNING: Record<ExercisePickerMode, ModeTuning> = {
  balance: {
    previousCategory: 0.2,
    previousGroup: 0.45,
    todayCategory: 0.45,
    todayGroup: 0.8,
    neglectMax: 1.8,
    focusPrimary: 1.6,
    focusAccent: 1.25,
    avoidPreviousCategory: false,
    pushLagging: 1,
    pushOthers: 1
  },
  rotation: {
    previousCategory: 0.15,
    previousGroup: 0.3,
    todayCategory: 0.35,
    todayGroup: 0.7,
    neglectMax: 2.2,
    focusPrimary: 1.4,
    focusAccent: 1.15,
    avoidPreviousCategory: true,
    pushLagging: 1,
    pushOthers: 1
  },
  focus: {
    previousCategory: 0.35,
    previousGroup: 0.6,
    todayCategory: 0.5,
    todayGroup: 0.85,
    neglectMax: 1.3,
    focusPrimary: 2.4,
    focusAccent: 1.6,
    avoidPreviousCategory: false,
    pushLagging: 1,
    pushOthers: 1
  },
  push: {
    previousCategory: 0.25,
    previousGroup: 0.5,
    todayCategory: 0.4,
    todayGroup: 0.8,
    neglectMax: 2,
    focusPrimary: 1.3,
    focusAccent: 1.1,
    avoidPreviousCategory: false,
    pushLagging: 3,
    pushOthers: 0.5
  }
}

export interface PickerContext {
  /** Defaults to the starter catalog */
  catalog?: Exercise[]
  recentSessions: Session[]
  settings: AppSettings
  now?: Date
  /** Injectable RNG so callers (and tests) can make the pick deterministic */
  random?: () => number
}

interface Scene {
  now: number
  previous: Exercise | null
  todayCategories: Set<string>
  todayGroups: Set<ExerciseGroup>
  lastUsedAt: Map<string, number>
}

interface ScoredExercise {
  exercise: Exercise
  weight: number
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isAvailable(exercise: Exercise, settings: AppSettings): boolean {
  const equipment = exercise.equipment
  if (!equipment || equipment.length === 0) return true
  if (!settings.inventory.enabled) return false
  return equipment.every((item) => settings.inventory.items.includes(item))
}

function doneSessions(sessions: Session[]): { session: Session; at: number }[] {
  const done: { session: Session; at: number }[] = []
  for (const session of sessions) {
    if (session.status !== 'done') continue
    const at = Date.parse(session.completedAt ?? session.triggeredAt)
    if (Number.isNaN(at)) continue
    done.push({ session, at })
  }
  return done
}

function buildScene(catalogById: Map<string, Exercise>, sessions: Session[], now: number): Scene {
  const today = new Date(now)

  let previous: Exercise | null = null
  let previousAt = Number.NEGATIVE_INFINITY
  const todayCategories = new Set<string>()
  const todayGroups = new Set<ExerciseGroup>()
  const lastUsedAt = new Map<string, number>()

  for (const { session, at } of doneSessions(sessions)) {
    const exercise = catalogById.get(session.exerciseId)
    if (at > previousAt) {
      previousAt = at
      previous = exercise ?? null
    }
    if (!exercise) continue
    if (isSameDay(new Date(at), today)) {
      todayCategories.add(exercise.category)
      if (exercise.group) todayGroups.add(exercise.group)
    }
    lastUsedAt.set(exercise.category, Math.max(lastUsedAt.get(exercise.category) ?? at, at))
  }

  return { now, previous, todayCategories, todayGroups, lastUsedAt }
}

function neglectBonus(category: string, scene: Scene, tuning: ModeTuning): number {
  const last = scene.lastUsedAt.get(category)
  const days = last === undefined ? NEGLECT_DAYS : (scene.now - last) / DAY_MS
  const ratio = Math.min(Math.max(days, 0), NEGLECT_DAYS) / NEGLECT_DAYS
  return 1 + ratio * (tuning.neglectMax - 1)
}

function focusBonus(exercise: Exercise, focus: UserFocus, tuning: ModeTuning): number {
  const tags = exercise.focus
  if (!tags || tags.length === 0) return 1
  if (focus.primary && tags.includes(focus.primary)) return tuning.focusPrimary
  if (focus.accents.some((accent) => tags.includes(accent))) return tuning.focusAccent
  return 1
}

/** Category with the oldest last use among the candidates; catalog order breaks ties. */
function laggingCategory(candidates: Exercise[], scene: Scene): string | null {
  let lagging: string | null = null
  let oldest = Number.POSITIVE_INFINITY
  for (const exercise of candidates) {
    const last = scene.lastUsedAt.get(exercise.category) ?? Number.NEGATIVE_INFINITY
    if (last < oldest) {
      oldest = last
      lagging = exercise.category
    }
  }
  return lagging
}

function weigh(
  candidates: Exercise[],
  scene: Scene,
  settings: AppSettings,
  tuning: ModeTuning,
  lagging: string | null
): ScoredExercise[] {
  return candidates.map((exercise) => {
    let weight = 1

    if (scene.previous) {
      if (scene.previous.category === exercise.category) weight *= tuning.previousCategory
      else if (exercise.group && scene.previous.group === exercise.group) {
        weight *= tuning.previousGroup
      }
    }

    if (scene.todayCategories.has(exercise.category)) weight *= tuning.todayCategory
    if (exercise.group && scene.todayGroups.has(exercise.group)) weight *= tuning.todayGroup

    weight *= neglectBonus(exercise.category, scene, tuning)
    weight *= focusBonus(exercise, settings.focus, tuning)

    if (settings.pickerMode === 'push') {
      weight *= exercise.category === lagging ? tuning.pushLagging : tuning.pushOthers
    }

    return { exercise, weight }
  })
}

function pickWeighted(scored: ScoredExercise[], random: () => number): Exercise {
  const total = scored.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0) return scored[0].exercise

  let roll = random() * total
  for (const item of scored) {
    roll -= item.weight
    if (roll < 0) return item.exercise
  }
  return scored[scored.length - 1].exercise
}

export function pickNextExercise(context: PickerContext): Exercise {
  const settings = context.settings
  const tuning = TUNING[settings.pickerMode] ?? TUNING.balance
  const now = (context.now ?? nowDate()).getTime()
  const random = context.random ?? Math.random
  const catalog = context.catalog ?? EXERCISE_CATALOG

  const available = catalog.filter((exercise) => isAvailable(exercise, settings))
  if (available.length === 0) return FALLBACK_EXERCISE

  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]))
  const scene = buildScene(catalogById, context.recentSessions, now)

  let candidates = available
  if (tuning.avoidPreviousCategory && scene.previous) {
    const withoutPrevious = available.filter(
      (exercise) => exercise.category !== scene.previous?.category
    )
    if (withoutPrevious.length >= MIN_ROTATION_CANDIDATES) candidates = withoutPrevious
  }

  const scored = weigh(candidates, scene, settings, tuning, laggingCategory(candidates, scene))
  return pickWeighted(scored, random)
}
