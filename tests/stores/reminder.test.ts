import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReminderStore } from '@/stores/reminder'

const at = new Date('2026-10-30T15:30:00+03:00').toISOString()

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('reminder store', () => {
  it('mirrors the main-process loop state', () => {
    const store = useReminderStore()
    store.apply({ paused: true, nextTriggerAt: at, countdownAnchorAt: null, heldProgress: null, intervalMinutes: 30 })

    expect(store.paused).toBe(true)
    expect(store.nextTriggerAt).toBe(at)
    expect(store.intervalMinutes).toBe(30)
  })

  it('labels a paused schedule', () => {
    const store = useReminderStore()
    store.apply({ paused: true, nextTriggerAt: at, countdownAnchorAt: null, heldProgress: 0.4, intervalMinutes: 45 })
    expect(store.nextTriggerLabel).toBe('Напоминания на паузе')
  })

  it('labels a schedule without a next trigger', () => {
    const store = useReminderStore()
    store.apply({ paused: false, nextTriggerAt: null, countdownAnchorAt: null, heldProgress: null, intervalMinutes: 45 })
    expect(store.nextTriggerLabel).toBe('Следующее напоминание — после сессии')
  })

  it('labels an upcoming trigger with its local time', () => {
    const store = useReminderStore()
    store.apply({ paused: false, nextTriggerAt: at, countdownAnchorAt: at, heldProgress: null, intervalMinutes: 45 })
    expect(store.nextTriggerLabel).toMatch(/^Следующее напоминание в \d{2}:\d{2}$/)
  })

  it('falls back for an unparsable timestamp', () => {
    const store = useReminderStore()
    store.apply({ paused: false, nextTriggerAt: 'not-a-date', countdownAnchorAt: null, heldProgress: null, intervalMinutes: 45 })
    expect(store.nextTriggerLabel).toBe('Следующее напоминание — после сессии')
  })
})
