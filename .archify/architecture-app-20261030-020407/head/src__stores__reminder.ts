import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { SessionLoopStatePayload } from '@shared/types/events'

/**
 * Main-owned reminder schedule, mirrored for UI (ROADMAP #2).
 * Read on boot, then kept fresh by `session:loop-changed`.
 */
export const useReminderStore = defineStore('reminder', () => {
  const paused = ref(false)
  const nextTriggerAt = ref<string | null>(null)
  const intervalMinutes = ref(45)

  function apply(next: SessionLoopStatePayload): void {
    paused.value = next.paused
    nextTriggerAt.value = next.nextTriggerAt
    intervalMinutes.value = next.intervalMinutes
  }

  const nextTriggerLabel = computed(() => {
    if (paused.value) return 'Напоминания на паузе'
    if (!nextTriggerAt.value) return 'Следующее напоминание — после сессии'

    const at = new Date(nextTriggerAt.value)
    if (Number.isNaN(at.getTime())) return 'Следующее напоминание — после сессии'

    const time = at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return `Следующее напоминание в ${time}`
  })

  return {
    paused,
    nextTriggerAt,
    intervalMinutes,
    nextTriggerLabel,
    apply
  }
})
