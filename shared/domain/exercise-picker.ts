import { EXERCISE_CATALOG, FALLBACK_EXERCISE } from '../constants/exercises'
import type { Exercise } from '../types/exercise'
import type { Session } from '../types/session'
import type { AppSettings } from '../types/settings'
import { resolveCatalog } from './catalog'
import { upgradeExercise, toExerciseV1 } from './exercise-v2'
import { compactPickTrace, explainPick, pickExercise, type PickTrace } from './picker'
import { nowDate } from './clock'
import { emptyFocusV2, migrateFocusV1 } from './focus-v2'

/**
 * Thin adapter over picker v2 (CATALOG-V2 §4).
 * Legacy callers keep using `pickNextExercise` with v1 Exercise[].
 */

export interface PickerContext {
  catalog?: Exercise[]
  recentSessions: Session[]
  settings: AppSettings
  now?: Date
  /** Injectable RNG so callers (and tests) can make the pick deterministic */
  random?: () => number
}

function seedFromRandom(random: () => number): number {
  return Math.floor(random() * 0xffffffff) >>> 0
}

function hasAnyFocus(focus: { zones: Record<string, number>; methods: Record<string, number> }): boolean {
  return (
    Object.values(focus.zones).some((level) => level !== 0) ||
    Object.values(focus.methods).some((level) => level !== 0)
  )
}

export interface PickedExercise {
  exercise: Exercise
  pickTrace: PickTrace
}

export function pickNextExerciseDetailed(context: PickerContext): PickedExercise {
  const settings = context.settings
  const now = context.now ?? nowDate()
  const random = context.random ?? Math.random
  const seed = seedFromRandom(random)

  const v1Catalog = context.catalog ?? EXERCISE_CATALOG
  const legacyById = new Map(v1Catalog.map((exercise) => [exercise.id, exercise.category]))

  // Caller-supplied catalogs (tests, getAvailableCatalog) are already merged; upgrade in place.
  const upgraded = v1Catalog.map((exercise) => upgradeExercise(exercise))
  const resolved = resolveCatalog(upgraded, [], settings.overrides ?? {})

  if (resolved.length === 0) {
    return { exercise: FALLBACK_EXERCISE, pickTrace: { seed, factors: [] } }
  }

  const focus =
    settings.focusV2 && hasAnyFocus(settings.focusV2)
      ? settings.focusV2
      : migrateFocusV1(settings.focus)

  const input = {
    catalog: resolved,
    recentSessions: context.recentSessions,
    settings,
    focus: focus ?? emptyFocusV2(),
    profileStrength: settings.profileStrength ?? 0.7,
    overrides: settings.overrides,
    limitations: settings.limitations,
    useShareProfile: true as const,
    now
  }

  const explanation = explainPick(input, seed)
  const hasEligible = explanation.candidates.some((candidate) => !candidate.filteredBy)
  if (!hasEligible) {
    return { exercise: FALLBACK_EXERCISE, pickTrace: compactPickTrace(explanation) }
  }

  const picked = pickExercise(input, seed)
  // pickExercise may still return a filtered row when all weights are 0 — guard again.
  const chosen = explanation.candidates.find((candidate) => candidate.id === picked.id)
  if (chosen?.filteredBy) {
    return { exercise: FALLBACK_EXERCISE, pickTrace: compactPickTrace(explanation) }
  }

  return {
    exercise: toExerciseV1(picked, legacyById.get(picked.id)),
    pickTrace: compactPickTrace(explanation)
  }
}

export function pickNextExercise(context: PickerContext): Exercise {
  return pickNextExerciseDetailed(context).exercise
}
