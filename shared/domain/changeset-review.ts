import type { Changeset, CatalogState } from './changeset'
import type { ExerciseV2 } from '../types/exercise-v2'
import { METHOD_LABELS, ZONE_LABELS, LIMITATION_LABELS } from '../constants/catalog-axes'

export interface ChangesetReviewRow {
  index: number
  title: string
  action: string
  fields: { label: string; before: string; after: string }[]
}
export interface ChangesetReview {
  token: string
  rows: ChangesetReviewRow[]
}
export type ApplyReviewedResult =
  | { status: 'applied'; changeset: Changeset }
  | { status: 'stale' | 'unavailable'; message: string }

const FIELD_LABELS: Record<string, string> = {
  title: 'Название', description: 'Инструкция', timer: 'Длительность', reps: 'Повторы',
  intensity: 'Нагрузка', difficulty: 'Сложность', zones: 'Зоны нагрузки', method: 'Направление',
  context: 'Условия выполнения', avoidIf: 'Ограничения', equipment: 'Инвентарь'
}

function format(value: unknown, field: string): string {
  if (value === undefined || value === null) return '—'
  if (field === 'method') return METHOD_LABELS[value as keyof typeof METHOD_LABELS] ?? String(value)
  if (field === 'timer' && typeof value === 'object') {
    const timer = value as { minSec?: number; defaultSec?: number; maxSec?: number; perSide?: boolean }
    return [timer.defaultSec !== undefined ? `${timer.defaultSec} с` : '', timer.minSec !== undefined && timer.maxSec !== undefined ? `диапазон ${timer.minSec}–${timer.maxSec} с` : '', timer.perSide ? 'на каждую сторону' : ''].filter(Boolean).join(' · ') || 'Без изменения длительности'
  }
  if (field === 'zones' && typeof value === 'object') return Object.entries(value).map(([key, share]) => `${ZONE_LABELS[key as keyof typeof ZONE_LABELS] ?? key}: ${Math.round(Number(share) * 100)}%`).join(', ')
  if (field === 'avoidIf' && Array.isArray(value)) return value.map(key => LIMITATION_LABELS[key as keyof typeof LIMITATION_LABELS] ?? key).join(', ') || 'Нет'
  if (field === 'context' && typeof value === 'object') {
    const context = value as { posture?: string; quiet?: boolean; noSweat?: boolean }
    const posture: Record<string, string> = { seated: 'Сидя', standing: 'Стоя', floor: 'На полу' }
    return [posture[context.posture ?? ''] ?? '', context.quiet ? 'Тихо' : 'Возможен шум', context.noSweat ? 'Без пота' : 'Активная нагрузка'].filter(Boolean).join(' · ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Compare against the actual apply input, never infer historical before-values. */
export function changesetReviewRows(changeset: Changeset, state: CatalogState, shipped: readonly ExerciseV2[]): ChangesetReviewRow[] {
  const byId = new Map([...shipped, ...state.exercises].map(exercise => [exercise.id, exercise]))
  return changeset.ops.map((record, index) => {
    const op = record.op
    if (op.op === 'add') return { index, title: op.exercise.title, action: 'Добавить упражнение', fields: Object.entries(op.exercise).filter(([key]) => key in FIELD_LABELS).map(([key, value]) => ({ label: FIELD_LABELS[key]!, before: '—', after: format(value, key) })) }
    if (op.op === 'update') {
      const before = byId.get(op.id)
      return { index, title: before?.title ?? op.id, action: shipped.some(ex => ex.id === op.id) ? 'Создать свой вариант встроенного упражнения' : 'Изменить упражнение', fields: Object.entries(op.patch).map(([key, value]) => ({ label: FIELD_LABELS[key] ?? key, before: format(before?.[key as keyof ExerciseV2], key), after: format(value, key) })) }
    }
    if (op.op === 'archive' || op.op === 'unarchive') return { index, title: byId.get(op.id)?.title ?? op.id, action: op.op === 'archive' ? 'Убрать в архив' : 'Вернуть из архива', fields: [] }
    if (op.op === 'profile_shift') return { index, title: op.axis === 'zone' ? ZONE_LABELS[op.key as keyof typeof ZONE_LABELS] ?? op.key : METHOD_LABELS[op.key as keyof typeof METHOD_LABELS] ?? op.key, action: 'Временный приоритет', fields: [{ label: 'Приоритет', before: 'Текущий профиль', after: `${op.level > 0 ? 'Чаще' : 'Реже'} · до ${op.until}` }] }
    return { index, title: op.key, action: 'Отменить временный приоритет', fields: [] }
  })
}
