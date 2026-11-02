import type { FocusLevel, Limitation, Method, Zone } from '../types/exercise-v2'

export const ZONES: readonly Zone[] = ['upper', 'core', 'lower', 'full']

export const ZONE_LABELS: Record<Zone, string> = {
  upper: 'Верх',
  core: 'Кор и пояс',
  lower: 'Низ',
  full: 'Комплекс'
}

export const METHODS: readonly Method[] = [
  'mobility',
  'strength',
  'cardio',
  'striking',
  'balance'
]

export const METHOD_LABELS: Record<Method, string> = {
  mobility: 'Растяжки и йога',
  strength: 'Силовая',
  cardio: 'Лёгкая атлетика',
  striking: 'Ударка',
  balance: 'Баланс'
}

export const FOCUS_LEVELS: readonly FocusLevel[] = [-1, 0, 1, 2]

export const FOCUS_LEVEL_LABELS: Record<FocusLevel, string> = {
  [-1]: '−',
  0: '0',
  1: '+',
  2: '++'
}

export function isZone(value: unknown): value is Zone {
  return typeof value === 'string' && (ZONES as readonly string[]).includes(value)
}

export function isMethod(value: unknown): value is Method {
  return typeof value === 'string' && (METHODS as readonly string[]).includes(value)
}

export const LIMITATIONS: readonly Limitation[] = [
  'neck',
  'shoulder',
  'wrist',
  'lower_back',
  'knee',
  'ankle'
]

export const LIMITATION_LABELS: Record<Limitation, string> = {
  neck: 'Шея',
  shoulder: 'Плечо',
  wrist: 'Запястье',
  lower_back: 'Поясница',
  knee: 'Колено',
  ankle: 'Голеностоп'
}
