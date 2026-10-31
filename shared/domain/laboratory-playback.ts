import type { Session } from '../types/session'
import { advanceCharacterCondition } from './character-condition'
import { BRANCH_WINDOW, computeCharacterProgress, STAGE_THRESHOLDS } from './character-progress'
import { localDateKey } from './stats'

export type LabPlaybackMode = 'automatic' | 'interactive'
export type LabOutcome = Session['status'] | 'closed'
export type LabAction = 'reminder' | 'start' | 'exercise' | 'done' | 'skipped' | 'snoozed' | 'close' | 'timeout' | 'repeat'
export type LabPhase = 'idle' | 'gap' | 'reminder' | 'start' | 'exercise' | 'choice' | 'saving' | 'saved' | 'reaction' | 'closing' | 'repeat' | 'finished' | 'error'

export const LAB_PHASE_LABELS: Record<LabPhase, string> = {
  idle: 'Готов к проигрыванию', gap: 'Переход к событию', reminder: 'Появилось напоминание',
  start: 'Начал упражнение', exercise: 'Выполняет упражнение', choice: 'Выбор действия',
  saving: 'Сохраняем результат', saved: 'Результат сохранён', reaction: 'Реакция персонажа',
  closing: 'Закрываем напоминание', repeat: 'Повтор после откладывания', finished: 'Сценарий завершён', error: 'Нужен повтор действия'
}

/** A semantic action plan, never renderer code or screen coordinates. */
export function labActions(session: Session): LabAction[] {
  if (session.status === 'missed') return ['reminder', 'timeout']
  if (session.status === 'snoozed') return ['reminder', 'snoozed', 'repeat']
  if (session.status === 'skipped') return ['reminder', 'start', session.skipReason === 'popup-closed' ? 'close' : 'skipped']
  return ['reminder', 'start', 'exercise', 'done']
}

export interface LabPlaybackState {
  generation: number
  mode: LabPlaybackMode
  phase: LabPhase
  eventIndex: number | null
  sessionId: string | null
  action: string
  waiting: boolean
  paused: boolean
  error: string
}

export type LabDriverAction = 'highlight-start' | 'start' | 'highlight-done' | 'highlight-skipped' | 'highlight-snoozed' | 'hold' | 'done' | 'skipped' | 'snoozed' | 'cancel'
export interface LabDriverCommand {
  generation: number
  sessionId: string
  sequence: number
  action: LabDriverAction
}
export interface LabDriverAck {
  sessionId: string
  generation?: number
  sequence?: number
  kind: 'ready' | 'applied' | 'failed' | 'manual' | 'feedback-complete'
}

/** Bounded rolling branch window and one condition transition per resolved session. */
export function labDynamics(sessions: readonly Session[], now: Date) {
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
