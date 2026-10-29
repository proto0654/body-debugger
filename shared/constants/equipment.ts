/**
 * Home inventory items (CONCEPT.md §10). Ids are permanent: they are stored in
 * `settings.inventory.items` and referenced by `Exercise.equipment`.
 */
export interface EquipmentItem {
  id: string
  title: string
  emoji: string
}

export const EQUIPMENT_CATALOG: readonly EquipmentItem[] = [
  { id: 'bag-50', title: 'Мешок 50 кг', emoji: '🥊' },
  { id: 'punching-bag', title: 'Боксёрская груша', emoji: '🥊' },
  { id: 'resistance-band', title: 'Резинка', emoji: '🎗️' },
  { id: 'dumbbells', title: 'Гантели', emoji: '🏋️' }
]

const EQUIPMENT_IDS = new Set(EQUIPMENT_CATALOG.map((item) => item.id))

export function isEquipmentId(value: unknown): value is string {
  return typeof value === 'string' && EQUIPMENT_IDS.has(value)
}
