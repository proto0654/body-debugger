import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  emptyQueue,
  normalizeQueue,
  QUEUE_SLOT_DEFAULT,
  queueSummaryLabel,
  type BreakQueue,
  type QueueSlot
} from '@shared/domain/queue'
import { useCatalogStore } from '@/stores/catalog'

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const useQueueStore = defineStore('breakQueue', () => {
  const queue = ref<BreakQueue>(emptyQueue())

  const summary = computed(() => {
    const catalog = useCatalogStore()
    return queueSummaryLabel(queue.value, (id) => catalog.resolved.find((ex) => ex.id === id)?.title)
  })

  async function refresh(): Promise<void> {
    try {
      const payload = await window.api?.getBreakQueue?.()
      if (payload) {
        queue.value = normalizeQueue(payload, todayIso())
        return
      }
    } catch (cause) {
      console.warn('[queue] getBreakQueue unavailable', cause)
    }
    queue.value = emptyQueue()
  }

  async function persist(next: BreakQueue): Promise<void> {
    queue.value = next
    try {
      await window.api?.saveBreakQueue?.(next)
    } catch (cause) {
      console.warn('[queue] saveBreakQueue failed', cause)
    }
  }

  async function setSlot(index: number, slot: QueueSlot): Promise<void> {
    const slots = [...queue.value.slots]
    while (slots.length <= index) slots.push({ kind: 'empty' })
    slots[index] = slot
    await persist({ ...queue.value, slots: slots.slice(0, 5) })
  }

  async function clearSlot(index: number): Promise<void> {
    await setSlot(index, { kind: 'empty' })
  }

  async function pinExercise(exerciseId: string, index = 0): Promise<void> {
    await setSlot(index, { kind: 'pin', exerciseId })
  }

  async function excludeToday(exerciseId: string): Promise<void> {
    const day = todayIso()
    const excludeTodayIds = queue.value.excludeDay === day ? [...queue.value.excludeToday] : []
    if (!excludeTodayIds.includes(exerciseId)) excludeTodayIds.push(exerciseId)
    await persist({ ...queue.value, excludeToday: excludeTodayIds, excludeDay: day })
  }

  async function ensureSlots(count = QUEUE_SLOT_DEFAULT): Promise<void> {
    const slots = [...queue.value.slots]
    while (slots.length < count) slots.push({ kind: 'empty' })
    await persist({ ...queue.value, slots: slots.slice(0, 5) })
  }

  return {
    queue,
    summary,
    refresh,
    persist,
    setSlot,
    clearSlot,
    pinExercise,
    excludeToday,
    ensureSlots
  }
})
