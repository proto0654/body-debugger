import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '../constants/character'
import type { Session } from '../types/session'
import type { Streak } from '../types/progress'
import type { CharacterCondition } from './character-condition'
import { computeCharacterCondition } from './character-condition'
import type { CharacterProgress } from './character-progress'
import { characterJourney, computeCharacterProgress } from './character-progress'
import { computeStreak } from './streak'

/**
 * One consistent snapshot of the character at a point in time. Used by the
 * laboratory timeline and the dashboard chronicle so both views share exactly
 * the same stage, branch, condition and streak rules.
 */
export interface SessionSummary {
  journey: ReturnType<typeof characterJourney>
  character: CharacterProgress
  condition: CharacterCondition
  streak: Streak
}

export function summarizeSessions(sessions: readonly Session[], at: Date): SessionSummary {
  return {
    journey: characterJourney(sessions),
    character: computeCharacterProgress(sessions),
    condition: computeCharacterCondition(sessions),
    streak: computeStreak(sessions, at)
  }
}

/** Explain a summary transition; shared by the laboratory and the chronicle. */
export function describeSummaryChange(
  before: SessionSummary,
  after: SessionSummary,
  session?: Session
): string {
  const changes: string[] = []
  if (before.character.stage !== after.character.stage) {
    changes.push(`Новая форма: ${CHARACTER_STAGE_LABELS[after.character.stage]}`)
  }
  if (before.character.branch !== after.character.branch) {
    changes.push(`Направление: ${CHARACTER_BRANCH_LABELS[after.character.branch]}`)
  }
  if (before.condition.points !== after.condition.points) {
    changes.push(`Ухудшение: ${before.condition.points} → ${after.condition.points} / 10; достигнутая форма сохранена`)
  }
  if (before.streak.current > 0 && after.streak.current === 0) {
    changes.push('Серия дней прервана; пустые дни не ухудшают тело')
  } else if (after.streak.current > before.streak.current) {
    changes.push(`Серия: ${after.streak.current} дней`)
  }
  if (session?.status === 'snoozed') {
    changes.push('Откладывание не добавляет ухудшения и не продвигает форму')
  }
  return changes.join(' · ') || 'Форма и состояние без изменений'
}
