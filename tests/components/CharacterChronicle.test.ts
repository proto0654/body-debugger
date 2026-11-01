import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import CharacterChronicle from '@/components/character/CharacterChronicle.vue'
import { makeSession } from '../fixtures'
import type { CharacterContext, ManualCharacterState } from '@shared/domain/character-context'
import type { Session } from '@shared/types/session'

const CalendarStub = defineComponent({
  name: 'CalendarHeatmap',
  props: { sessions: { type: Array, default: () => [] }, now: { type: Date, default: () => new Date() }, catalog: { type: Array, default: () => [] } },
  template: '<div data-testid="calendar-stub" :data-sessions="sessions.length" :data-now="now ? now.toISOString() : \'\'" />'
})

const NOW = new Date(2026, 9, 31, 12, 0, 0)

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

function context(sessions: Session[], overrides: Partial<CharacterContext> = {}): CharacterContext {
  return {
    id: 'test',
    title: 'Test',
    sessions,
    packId: 'desk-hulk',
    build: 'average',
    allowStart: true,
    manual: null,
    ...overrides
  }
}

function mountChronicle(sessions: Session[], overrides: Partial<CharacterContext> = {}, now = NOW): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(CharacterChronicle, {
    props: { now, context: context(sessions, overrides) },
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

  it('hides the workout call to action in a read-only context', () => {
    wrapper = mountChronicle([], { allowStart: false })
    expect(wrapper.find('[data-testid="chronicle-empty"] button').exists()).toBe(false)
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

  it('renders a temporary manual override without changing the context sessions', async () => {
    const sessions = history()
    const manual: ManualCharacterState = { stage: 5, branch: 'power', build: 'stocky', condition: 3, emotion: 'happy' }
    wrapper = mountChronicle(sessions, { manual })
    await nextTick()
    const portrait = wrapper.get('[data-testid="chronicle-scene"] [data-stage]')
    expect(portrait.attributes('data-stage')).toBe('5')
    expect(portrait.attributes('data-emotion')).toBe('happy')
    expect(wrapper.find('[data-testid="chronicle-manual-badge"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="chronicle-scene"]').text()).toContain('Ручной вид меняет только картинку')
    expect(sessions).toHaveLength(3)
  })
})
