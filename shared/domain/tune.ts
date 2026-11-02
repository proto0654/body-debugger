import {
  HINT_SKIP_THRESHOLD,
  HINT_WINDOW,
  PERSONAL_SCALE_STEP
} from '../constants/catalog-tuning'
import type { ExerciseV2Resolved } from '../types/exercise-v2'
import type { Session } from '../types/session'

export type ExerciseHintKind = 'ready_to_progress' | 'often_skipped'

export interface ExerciseHint {
  exerciseId: string
  kind: ExerciseHintKind
  suggestedScale: number
}

/**
 * Derive per-exercise hints from recent shows (CATALOG-V2 §9.1).
 * `snoozed` is ignored; `skipped` and `missed` count as skips.
 */
export function exerciseHints(
  sessions: readonly Session[],
  catalog: readonly ExerciseV2Resolved[],
  scales: Readonly<Record<string, number>> = {},
  cooldownIds: ReadonlySet<string> = new Set()
): ExerciseHint[] {
  const byExercise = new Map<string, Session[]>()
  for (const session of sessions) {
    if (session.status === 'snoozed') continue
    const list = byExercise.get(session.exerciseId) ?? []
    list.push(session)
    byExercise.set(session.exerciseId, list)
  }

  const hints: ExerciseHint[] = []
  for (const exercise of catalog) {
    if (cooldownIds.has(exercise.id)) continue
    const shows = (byExercise.get(exercise.id) ?? [])
      .slice()
      .sort((a, b) => {
        const aAt = Date.parse(a.completedAt ?? a.triggeredAt)
        const bAt = Date.parse(b.completedAt ?? b.triggeredAt)
        return (Number.isNaN(aAt) ? 0 : aAt) - (Number.isNaN(bAt) ? 0 : bAt)
      })
      .slice(-HINT_WINDOW)
    if (shows.length < HINT_WINDOW) continue

    const currentScale = scales[exercise.id] ?? 1
    const allDone = shows.every((session) => session.status === 'done')
    const skips = shows.filter(
      (session) => session.status === 'skipped' || session.status === 'missed'
    ).length

    if (allDone) {
      hints.push({
        exerciseId: exercise.id,
        kind: 'ready_to_progress',
        suggestedScale: Number((currentScale * (1 + PERSONAL_SCALE_STEP)).toFixed(2))
      })
    } else if (skips >= HINT_SKIP_THRESHOLD) {
      hints.push({
        exerciseId: exercise.id,
        kind: 'often_skipped',
        suggestedScale: Number((currentScale * (1 - PERSONAL_SCALE_STEP)).toFixed(2))
      })
    }
  }
  return hints
}
