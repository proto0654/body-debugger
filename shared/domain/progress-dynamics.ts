import type { Session } from '../types/session'
import { advanceCharacterCondition } from './character-condition'
import { BRANCH_WINDOW, computeCharacterProgress, STAGE_THRESHOLDS } from './character-progress'
import { localDateKey } from './stats'

/**
 * Cumulative completion / condition series and markers over a resolved history.
 * Shared by the laboratory charts and the dashboard chronicle.
 */
export function buildProgressDynamics(sessions: readonly Session[], now: Date) {
  const seen = new Set<string>()
  const ordered = sessions.filter(session => Date.parse(session.completedAt ?? session.triggeredAt) <= now.getTime())
    .slice().sort((a, b) => Date.parse(a.completedAt ?? a.triggeredAt) - Date.parse(b.completedAt ?? b.triggeredAt))
  const points: { at: number; done: number; condition: number }[] = []
  const markers: { at: number; label: string }[] = []
  const recent: Session[] = []
  let done = 0
  let condition = 0
  let branch = 'neutral'
  let lastDoneDay: number | null = null
  let breakShown = false
  for (const session of ordered) {
    if (seen.has(session.id)) continue
    seen.add(session.id)
    const at = Date.parse(session.completedAt ?? session.triggeredAt)
    const day = Date.parse(`${localDateKey(new Date(at))}T00:00:00Z`)
    if (lastDoneDay !== null && day - lastDoneDay > 86400000 && !breakShown) {
      markers.push({ at, label: 'Серия прервана' }); breakShown = true
    }
    condition = advanceCharacterCondition(condition, session.status)
    if (session.status === 'done') {
      done++
      lastDoneDay = day
      breakShown = false
      const stage = STAGE_THRESHOLDS.find(threshold => threshold.done === done)
      if (stage) markers.push({ at, label: `Новая форма ${stage.stage}` })
      recent.push(session)
      if (recent.length > BRANCH_WINDOW) recent.shift()
      const nextBranch = computeCharacterProgress(recent).branch
      if (nextBranch !== branch) { branch = nextBranch; markers.push({ at, label: 'Смена направления' }) }
    }
    points.push({ at, done, condition })
  }
  const today = Date.parse(`${localDateKey(now)}T00:00:00Z`)
  if (lastDoneDay !== null && today - lastDoneDay > 86400000 && !breakShown) markers.push({ at: now.getTime(), label: 'Серия прервана' })
  return { points, markers, done, condition }
}
