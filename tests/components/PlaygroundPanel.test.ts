import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import PlaygroundPanel from '@/components/character/PlaygroundPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'
import { useProgressStore } from '@/stores/progress'
import { makeSession, makeSettings } from '../fixtures'
import type { Session } from '@shared/types/session'

const CalendarStub = defineComponent({
  name: 'CalendarHeatmap',
  props: { sessions: { type: Array, default: () => [] }, now: { type: Date, default: () => new Date() }, catalog: { type: Array, default: () => [] } },
  template: '<div data-testid="calendar-stub" />'
})
const LabStub = defineComponent({
  name: 'PlaygroundLabWebview',
  template: '<div data-testid="lab-webview-stub" />'
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

function at(day: number): string {
  return new Date(2026, 9, day, 12, 0, 0).toISOString()
}

function history(): Session[] {
  return [
    makeSession({ exerciseId: 'neck-tilts', completedAt: at(28) }),
    makeSession({ exerciseId: 'neck-tilts', completedAt: at(29) }),
    makeSession({ exerciseId: 'neck-tilts', completedAt: at(30) })
  ]
}

function mountPlayground(sessions: Session[]): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(makeSettings())
  useProgressStore().hydrate({ ...progress })
  useSessionsStore().hydrate(sessions)
  return mount(PlaygroundPanel, {
    props: { now: NOW },
    global: {
      plugins: [pinia],
      stubs: { CalendarHeatmap: CalendarStub, ProgressDynamics: true, StatsPanel: true, PlaygroundLabWebview: LabStub }
    }
  })
}

let wrapper: VueWrapper | undefined
const saveSettings = vi.fn()
const saveProgress = vi.fn()

beforeEach(() => {
  saveSettings.mockClear(); saveProgress.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: { saveSettings, saveProgress } })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

describe('PlaygroundPanel', () => {
  it('renders the main-character context read-only', async () => {
    const sessions = history()
    wrapper = mountPlayground(sessions)
    await nextTick()
    expect(wrapper.get('[data-testid="playground"]').text()).toContain('Временные контексты')
    expect(wrapper.find('[data-testid="manual-character-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="chronicle"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="chronicle-scene"] [data-stage]').attributes('data-stage')).toBe('1')
    expect(sessions).toHaveLength(3)
    expect(saveSettings).not.toHaveBeenCalled()
    expect(saveProgress).not.toHaveBeenCalled()
  })

  it('applies a manual preview to the scene without touching the stores', async () => {
    const sessions = history()
    wrapper = mountPlayground(sessions)
    await nextTick()
    await wrapper.findAll('button').find(button => button.text() === 'Включить ручной вид')!.trigger('click')
    expect(wrapper.find('[data-testid="manual-character-preview"]').exists()).toBe(true)
    await wrapper.get('[data-preview-stage="5"]').trigger('click')
    await wrapper.get('[data-preview-emotion="happy"]').trigger('click')
    await nextTick()
    const portrait = wrapper.get('[data-testid="chronicle-scene"] [data-stage]')
    expect(portrait.attributes('data-stage')).toBe('5')
    expect(portrait.attributes('data-emotion')).toBe('happy')
    expect(wrapper.find('[data-testid="chronicle-manual-badge"]').exists()).toBe(true)
    expect(sessions).toHaveLength(3)
    expect(saveSettings).not.toHaveBeenCalled()
    expect(saveProgress).not.toHaveBeenCalled()

    await wrapper.findAll('button').find(button => button.text() === 'Сбросить к таймлайну')!.trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="chronicle-scene"] [data-stage]').attributes('data-stage')).toBe('1')
    expect(wrapper.find('[data-testid="chronicle-manual-badge"]').exists()).toBe(false)
  })

  it('switches to the laboratory context and keeps the main context intact', async () => {
    wrapper = mountPlayground(history())
    await nextTick()
    await wrapper.findAll('button').find(button => button.text() === 'Лаборатория')!.trigger('click')
    expect(wrapper.find('[data-testid="lab-webview-stub"]').exists()).toBe(true)
    await wrapper.findAll('button').find(button => button.text() === 'Основной персонаж')!.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="chronicle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lab-webview-stub"]').exists()).toBe(false)
  })
})
