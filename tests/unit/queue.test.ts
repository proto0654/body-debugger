import { describe, expect, it } from 'vitest'
import { applyQueue, emptyQueue, normalizeQueue, shiftQueue } from '../../shared/domain/queue'
import { resolveCatalog, shippedCatalogV2 } from '../../shared/domain/catalog'
import { emptyFocusV2 } from '../../shared/domain/focus-v2'
import { makeSettings } from '../fixtures'

function input() {
  return {
    catalog: resolveCatalog(shippedCatalogV2(), [], {}),
    recentSessions: [],
    settings: makeSettings({ intervalMinutes: 45 }),
    focus: emptyFocusV2(),
    profileStrength: 0.7,
    useShareProfile: true as const
  }
}

describe('normalizeQueue', () => {
  it('clears excludeToday when day changes', () => {
    const q = normalizeQueue(
      { slots: [], excludeToday: ['a'], excludeDay: '2020-01-01' },
      '2020-01-02'
    )
    expect(q.excludeToday).toEqual([])
    expect(q.excludeDay).toBe('2020-01-02')
  })
})

describe('applyQueue', () => {
  it('forces a valid pin', () => {
    const base = input()
    const id = base.catalog[0]!.id
    const queue = emptyQueue()
    queue.slots[0] = { kind: 'pin', exerciseId: id }
    const result = applyQueue(base, queue)
    expect(result.forcedId).toBe(id)
    expect(result.consumeSlot).toBe(true)
    expect(result.input.catalog).toHaveLength(1)
  })

  it('skips missing pin and keeps pool', () => {
    const base = input()
    const queue = emptyQueue()
    queue.slots[0] = { kind: 'pin', exerciseId: 'missing-id' }
    const result = applyQueue(base, queue)
    expect(result.forcedId).toBeUndefined()
    expect(result.notes.some((n) => n.reason === 'pin_missing')).toBe(true)
    expect(result.consumeSlot).toBe(true)
  })
})

describe('shiftQueue', () => {
  it('drops the first slot', () => {
    const queue = emptyQueue()
    queue.slots[0] = { kind: 'pin', exerciseId: 'x' }
    queue.slots[1] = { kind: 'constraint', axis: 'zone', key: 'upper' }
    const next = shiftQueue(queue)
    expect(next.slots[0]).toEqual({ kind: 'constraint', axis: 'zone', key: 'upper' })
  })
})
