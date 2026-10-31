import type { Session } from '../types/session'

export { buildProgressDynamics as labDynamics } from './progress-dynamics'

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