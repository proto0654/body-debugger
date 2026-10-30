import type { CharacterBuild, CharacterConditionLevel } from '../types/character'
import type { Session, SessionStatus } from '../types/session'

export const CHARACTER_CONDITION_MAX_POINTS = 10
export const CHARACTER_CONDITION_RECOVERY_POINTS = 2

export interface CharacterCondition {
  points: number
  level: CharacterConditionLevel
  recoverySessions: number
}

/** Shared transition for the current condition and laboratory time series. */
export function advanceCharacterCondition(points: number, status: SessionStatus): number {
  if (status === 'done') return Math.max(0, points - CHARACTER_CONDITION_RECOVERY_POINTS)
  if (status === 'skipped' || status === 'missed') return Math.min(CHARACTER_CONDITION_MAX_POINTS, points + 1)
  return points
}

/** Temporary visual condition, derived from durable results; never lowers earned stages. */
export function computeCharacterCondition(sessions: readonly Session[]): CharacterCondition {
  const ordered = sessions
    .filter(session => session.status !== 'snoozed')
    .map(session => ({ session, at: Date.parse(session.completedAt ?? session.triggeredAt) }))
    .filter(entry => Number.isFinite(entry.at))
    .sort((a, b) => a.at - b.at)
  const seen = new Set<string>()
  let points = 0
  for (const { session } of ordered) {
    if (seen.has(session.id)) continue
    seen.add(session.id)
    points = advanceCharacterCondition(points, session.status)
  }
  const level = points >= CHARACTER_CONDITION_MAX_POINTS ? 3 : points >= 6 ? 2 : points >= 3 ? 1 : 0
  return { points, level, recoverySessions: Math.ceil(points / CHARACTER_CONDITION_RECOVERY_POINTS) }
}

export function characterConditionLabel(level: CharacterConditionLevel, build: CharacterBuild): string {
  if (level === 0) return 'Форма держится'
  if (level === 1) return 'Теряет тонус'
  if (level === 2) return 'Теряет форму'
  if (build === 'lean') return 'Дрыщ'
  if (build === 'stocky') return 'Скуф'
  return 'Сутулый'
}
