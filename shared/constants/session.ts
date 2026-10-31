import type { SessionStatus } from '../types/session'

/** User-facing status names shared by the laboratory and the dashboard chronicle. */
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  done: 'Выполнено',
  skipped: 'Пропуск',
  snoozed: 'Отложено',
  missed: 'Таймаут'
}
