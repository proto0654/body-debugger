import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import CharacterChronicle from '@/components/character/CharacterChronicle.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'
import { useProgressStore } from '@/stores/progress'
import { makeSession, makeSettings } from '../fixtures'
import type { Session } from '@shared/types/session'

const CalendarStub = defineComponent({
  name: 'CalendarHeatmap',
  props: { sessions: { type: Array, default: () => [] }, now: { type: Date, default: () => new Date() }, catalog: { type: Array, default: () => [] } },
  template: '<div data-testid="calendar-stub" :data-sessions="sessions.length" :data-now="now ? now.toISOString() : \'\'" />'
})

const NOW = new Date(2026, 9, 31, 12, 0, 0)
const progress = {
  streak: { current: 0, max: 0 },
  characterStage: 0 as const,
  characterBranch: 'neutral' as const,
  characterBuild: 'average' as const,
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

function at(day: number, hour = 12): string {
  return new Date(2026, 9, day, hour, 0, 0).toISOString()
}

function history(): Session[] {
  return [
    makeSession({ exerciseId: 'neck-tilts', completedAt: at(28) }),
    makeSession({ exerciseId: 'neck-tilts', completedAt: at(29) }),
    makeSession({ exerciseId: 'neck-tilts', completedAt: at(30) })
  ]
}

function mountChronicle(sessions: Session[], now = NOW): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(makeSettings())
  useProgressStore().hydrate({ ...progress })
  useSessionsStore().hydrate(sessions)
  return mount(CharacterChronicle, {
    props: { now },
    global: { plugins: [pinia], stubs: { CalendarHeatmap: CalendarStub, ProgressDynamics: true, StatsPanel: true } }
  })
}

let wrapper: VueWrapper | undefined
const saveSettings = vi.fn()

beforeEach(() => {
  saveSettings.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: { saveSettings, saveProgress: vi.fn() } })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('CharacterChronicle', () => {
  it('offers an empty state and starts a workout on request', async () => {
    wrapper = mountChronicle([])
    expect(wrapper.find('[data-testid="chronicle-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="chronicle"]').exists()).toBe(false)
    await wrapper.get('[data-testid="chronicle-empty"] button').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('starts at the current end and scrubs back to the beginning without writes', async () => {
    wrapper = mountChronicle(history())
    await nextTick()
    expect(wrapper.get('[data-testid="chronicle-position"]').text()).toBe('Сейчас')
    expect(wrapper.get('[data-testid="chronicle-scene"] [data-stage]').attributes('data-stage')).toBe('1')
    expect(wrapper.get('[data-testid="chronicle-scene"] .character-badge').text()).toContain('2 / 6')
    expect(wrapper.get('[data-testid="calendar-stub"]').attributes('data-sessions')).toBe('3')

    await wrapper.findAll('button').find(button => button.text() === 'Сначала')!.trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="chronicle-position"]').text()).toBe('Начало истории')
    expect(wrapper.get('[data-testid="chronicle-scene"] [data-stage]').attributes('data-stage')).toBe('0')
    expect(wrapper.get('[data-testid="calendar-stub"]').attributes('data-sessions')).toBe('0')
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('jumps to a milestone and shows the matching form', async () => {
    wrapper = mountChronicle(history())
    await nextTick()
    const milestone = wrapper.findAll('button').find(button => button.text().includes('форма 2'))!
    await milestone.trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="chronicle-scene"] [data-stage]').attributes('data-stage')).toBe('1')
    expect(wrapper.get('[data-testid="chronicle-position"]').text()).toContain('Выполнено')
  })

  it('plays through the history and stops at the end', async () => {
    vi.useFakeTimers()
    wrapper = mountChronicle(history())
    await nextTick()
    await wrapper.get('[data-testid="chronicle-play"]').trigger('click')
    expect(wrapper.get('[data-testid="chronicle-position"]').text()).toBe('Начало истории')
    for (let step = 0; step < 4; step += 1) {
      vi.advanceTimersByTime(1500)
      await nextTick()
    }
    expect(wrapper.get('[data-testid="chronicle-position"]').text()).toBe('Сейчас')
    expect(wrapper.get('[data-testid="chronicle-play"]').text()).toContain('Проиграть с начала')
  })

  it('seeks to a local date', async () => {
    wrapper = mountChronicle(history())
    await nextTick()
    const input = wrapper.get('input[type="date"]')
    await input.setValue('2026-10-29')
    await nextTick()
    const range = wrapper.get('input[type="range"]').element as HTMLInputElement
    expect(range.value).toBe('2')
    expect(wrapper.get('[data-testid="chronicle-position"]').text()).toContain('Выполнено')
  })
})
