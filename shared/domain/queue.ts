/** Next-breaks queue (docs/CATALOG-UI.md §5 / §9). */

import type { Method, Zone } from '../types/exercise-v2'
import { isMethod, isZone } from '../constants/catalog-axes'
import type { PickInput } from './picker'
import { explainPick } from './picker'

export const QUEUE_SLOT_MAX = 5
export const QUEUE_SLOT_DEFAULT = 3

export type QueueSlot =
  | { kind: 'empty' }
  | { kind: 'pin'; exerciseId: string }
  | { kind: 'constraint'; axis: 'zone' | 'method'; key: Zone | Method }

export interface BreakQueue {
  slots: QueueSlot[]
  /** Exercise ids excluded until end of local day (ISO date YYYY-MM-DD). */
  excludeToday: string[]
  excludeDay: string
}

export interface QueueSkipNote {
  reason: 'pin_filtered' | 'pin_missing' | 'pin_archived' | 'exclude_today'
  exerciseId?: string
  detail: string
}

export interface ApplyQueueResult {
  input: PickInput
  /** When a pin wins, force this id after filters pass. */
  forcedId?: string
  notes: QueueSkipNote[]
  /** Whether the first non-empty slot was consumed conceptually (caller persists). */
  consumeSlot: boolean
}

export function emptyQueue(slotCount = QUEUE_SLOT_DEFAULT): BreakQueue {
  const n = Math.min(QUEUE_SLOT_MAX, Math.max(1, slotCount))
  return {
    slots: Array.from({ length: n }, () => ({ kind: 'empty' as const })),
    excludeToday: [],
    excludeDay: ''
  }
}

export function normalizeQueue(raw: unknown, todayIso: string): BreakQueue {
  const base = emptyQueue()
  if (!raw || typeof raw !== 'object') return { ...base, excludeDay: todayIso }
  const data = raw as Record<string, unknown>
  const slotsRaw = Array.isArray(data.slots) ? data.slots : []
  const slots: QueueSlot[] = []
  for (const item of slotsRaw.slice(0, QUEUE_SLOT_MAX)) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    if (s.kind === 'pin' && typeof s.exerciseId === 'string') {
      slots.push({ kind: 'pin', exerciseId: s.exerciseId })
    } else if (s.kind === 'constraint' && (s.axis === 'zone' || s.axis === 'method') && typeof s.key === 'string') {
      if (s.axis === 'zone' && isZone(s.key)) slots.push({ kind: 'constraint', axis: 'zone', key: s.key })
      if (s.axis === 'method' && isMethod(s.key)) slots.push({ kind: 'constraint', axis: 'method', key: s.key })
    } else if (s.kind === 'empty') {
      slots.push({ kind: 'empty' })
    }
  }
  while (slots.length < QUEUE_SLOT_DEFAULT) slots.push({ kind: 'empty' })
  const excludeDay = typeof data.excludeDay === 'string' ? data.excludeDay : todayIso
  let excludeToday = Array.isArray(data.excludeToday)
    ? data.excludeToday.filter((id): id is string => typeof id === 'string')
    : []
  if (excludeDay !== todayIso) excludeToday = []
  return { slots: slots.slice(0, QUEUE_SLOT_MAX), excludeToday, excludeDay: todayIso }
}

function localDayIso(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Restrict the pick input by the first queue slot and today's exclusions.
 * Pin that fails hard filters → skip note + normal pick (slot still consumed).
 */
export function applyQueue(input: PickInput, queue: BreakQueue): ApplyQueueResult {
  const now = input.now ?? new Date()
  const today = localDayIso(now)
  const notes: QueueSkipNote[] = []
  let catalog = input.catalog.filter((exercise) => {
    if (queue.excludeDay === today && queue.excludeToday.includes(exercise.id)) {
      return false
    }
    return true
  })

  const excluded = input.catalog.length - catalog.length
  if (excluded > 0) {
    notes.push({
      reason: 'exclude_today',
      detail: `исключено на сегодня: ${excluded}`
    })
  }

  const first = queue.slots[0]
  if (!first || first.kind === 'empty') {
    return { input: { ...input, catalog }, notes, consumeSlot: false }
  }

  if (first.kind === 'constraint') {
    const narrowed = catalog.filter((exercise) => {
      if (first.axis === 'zone') return exercise.dominantZone === first.key
      return exercise.method === first.key
    })
    return {
      input: { ...input, catalog: narrowed.length > 0 ? narrowed : catalog },
      notes:
        narrowed.length === 0
          ? [
              ...notes,
              {
                reason: 'pin_filtered',
                detail: `ограничение ${first.axis}:${first.key} — подходящих 0, обычный пик`
              }
            ]
          : notes,
      consumeSlot: true
    }
  }

  // pin
  const pinned = catalog.find((exercise) => exercise.id === first.exerciseId)
  if (!pinned) {
    const inFull = input.catalog.find((exercise) => exercise.id === first.exerciseId)
    notes.push({
      reason: inFull ? 'pin_archived' : 'pin_missing',
      exerciseId: first.exerciseId,
      detail: inFull ? 'закреплённое недоступно' : 'закреплённое не найдено'
    })
    return { input: { ...input, catalog }, notes, consumeSlot: true }
  }

  const probe = explainPick({ ...input, catalog: [pinned] }, 1)
  const candidate = probe.candidates[0]
  if (candidate?.filteredBy) {
    notes.push({
      reason: 'pin_filtered',
      exerciseId: first.exerciseId,
      detail: `закреплённое отфильтровано: ${candidate.filteredBy}`
    })
    return { input: { ...input, catalog }, notes, consumeSlot: true }
  }

  return {
    input: { ...input, catalog: [pinned] },
    forcedId: pinned.id,
    notes,
    consumeSlot: true
  }
}

/** Drop the first slot after a successful trigger that consumed it. */
export function shiftQueue(queue: BreakQueue): BreakQueue {
  const rest = queue.slots.slice(1)
  while (rest.length < QUEUE_SLOT_DEFAULT) rest.push({ kind: 'empty' })
  return { ...queue, slots: rest.slice(0, QUEUE_SLOT_MAX) }
}

export function queueSummaryLabel(
  queue: BreakQueue,
  titleOf: (id: string) => string | undefined
): string {
  const parts: string[] = []
  for (const slot of queue.slots) {
    if (slot.kind === 'empty') continue
    if (slot.kind === 'pin') {
      parts.push(titleOf(slot.exerciseId) ?? slot.exerciseId)
    } else if (slot.axis === 'zone') {
      parts.push(`любая из ${slot.key}`)
    } else {
      parts.push(`метод ${slot.key}`)
    }
  }
  return parts.length > 0 ? parts.join(' → ') : ''
}
