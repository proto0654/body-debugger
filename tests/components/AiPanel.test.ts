import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AiPanel from '@/components/catalog/AiPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import { useDashboardNavigation } from '@/stores/dashboard-navigation'
import { useAiAssistantStore } from '@/stores/ai-assistant'
import { useCatalogStore } from '@/stores/catalog'
import { userMainBatch } from '@shared/domain/catalog'
import { defaultProgress, defaultSettings } from '../../electron/main/persistence/defaults'

let wrapper: VueWrapper | undefined
let pinia: ReturnType<typeof createPinia>
const runLlm = vi.fn()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(defaultSettings())
  useCatalogStore().batches.push(userMainBatch())
  useDashboardNavigation().navigate('exercises', 'ai')
  runLlm.mockReset()
  Object.defineProperty(window, 'api', { configurable: true, value: {
    getLlmConfig: async () => ({ llm: useSettingsStore().asSettings().llm, hasKey: false }),
    listLlmChangesets: async () => [], runLlm,
    saveSettings: async (settings: ReturnType<typeof defaultSettings>) => ({ settings, progress: defaultProgress(), sessions: [], weights: [] })
  } })
})
afterEach(() => wrapper?.unmount())

describe('AI assistant entry and consent', () => {
  it('explains a missing connection and opens the separate connection settings', async () => {
    wrapper = mount(AiPanel, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Каталог и обычные разминки доступны без ИИ')
    expect(wrapper.get('.primary-action').attributes('disabled')).toBeDefined()
    await wrapper.findAll('button').find(button => button.text() === 'Настроить подключение →')!.trigger('click')
    expect(useDashboardNavigation().location).toEqual({ tab: 'settings', section: 'ai' })
    expect(runLlm).not.toHaveBeenCalled()
  })
  it('keeps progress analysis disabled until aggregate consent is saved', async () => {
    const settings = useSettingsStore()
    settings.llm = { ...settings.llm, enabled: true, baseUrl: 'mock://local', shareProgress: false }
    useDashboardNavigation().navigate('exercises', 'ai', { task: 'tune' })
    wrapper = mount(AiPanel, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.get('.primary-action').attributes('disabled')).toBeDefined()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await flushPromises()
    expect(settings.llm.shareProgress).toBe(true)
    expect(wrapper.get('.primary-action').attributes('disabled')).toBeUndefined()
    expect(runLlm).not.toHaveBeenCalled()
  })
  it('blocks rejected proposals and does not enable apply for an empty valid selection', async () => {
    wrapper = mount(AiPanel, { global: { plugins: [pinia] } })
    await flushPromises()
    const ai = useAiAssistantStore()
    ai.changeset = { id: 'draft', kind: 'edit', status: 'awaiting_approval', createdAt: new Date().toISOString(), ops: [{ op: { op: 'archive', id: 'missing' }, enabled: true, state: 'rejected', issues: ['Не найдено'] }] }
    ai.review = { token: 'review', rows: [{ index: 0, title: 'Недоступное упражнение', action: 'В архив', fields: [] }] }
    await nextTick()
    expect(wrapper.get('[data-testid="ai-draft"] input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="ai-draft"] .primary-action').attributes('disabled')).toBeDefined()
  })
})
