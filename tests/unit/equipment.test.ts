// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EQUIPMENT_CATALOG, isEquipmentId } from '@shared/constants/equipment'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'

describe('equipment catalog', () => {
  it('describes every equipment id used by the exercise catalog', () => {
    const used = new Set(
      EXERCISE_CATALOG.flatMap((exercise) => exercise.equipment ?? [])
    )

    expect(used.size).toBeGreaterThan(0)
    for (const id of Array.from(used)) {
      expect(isEquipmentId(id), id).toBe(true)
    }
  })

  it('has unique ids and non-empty Russian titles', () => {
    const ids = EQUIPMENT_CATALOG.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of EQUIPMENT_CATALOG) {
      expect(item.title.trim().length).toBeGreaterThan(0)
      expect(item.emoji.length).toBeGreaterThan(0)
    }
  })

  it('includes the 50 kg bag from CONCEPT.md §10', () => {
    expect(EQUIPMENT_CATALOG.find((item) => item.id === 'bag-50')?.title).toContain('50')
  })

  it('rejects unknown ids', () => {
    expect(isEquipmentId('bag-50')).toBe(true)
    expect(isEquipmentId('treadmill')).toBe(false)
    expect(isEquipmentId('')).toBe(false)
  })
})
