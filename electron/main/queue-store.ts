import { readJsonEnvelope, writeJsonEnvelope } from './persistence/json-file'
import { getQueuePath } from './persistence/paths'
import {
  emptyQueue,
  normalizeQueue,
  shiftQueue,
  type BreakQueue,
  type QueueSkipNote
} from '../../shared/domain/queue'

let queue: BreakQueue = emptyQueue()
let lastNotes: QueueSkipNote[] = []

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function loadQueueStore(): void {
  queue = normalizeQueue(readJsonEnvelope<unknown>(getQueuePath()), todayIso())
}

export function getBreakQueue(): BreakQueue {
  return {
    slots: queue.slots.map((slot) => ({ ...slot })),
    excludeToday: [...queue.excludeToday],
    excludeDay: queue.excludeDay
  }
}

export function saveBreakQueue(next: BreakQueue): BreakQueue {
  queue = normalizeQueue(next, todayIso())
  writeJsonEnvelope(getQueuePath(), queue)
  return getBreakQueue()
}

export function getLastQueueNotes(): QueueSkipNote[] {
  return [...lastNotes]
}

export function setLastQueueNotes(notes: QueueSkipNote[]): void {
  lastNotes = [...notes]
}

export function consumeQueueSlot(): BreakQueue {
  queue = shiftQueue(queue)
  writeJsonEnvelope(getQueuePath(), queue)
  return getBreakQueue()
}
