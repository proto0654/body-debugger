import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import CatalogLibrary from '@/components/catalog/CatalogLibrary.vue'
import { useSettingsStore } from '@/stores/settings'
import { useCatalogStore } from '@/stores/catalog'
import { useCatalogViewStore } from '@/stores/catalog-view'
import { useDashboardNavigation } from '@/stores/dashboard-navigation'
import { defaultSettings } from '../../electron/main/persistence/defaults'

const startExercise = vi.fn(async () => ({ status: 'started' }))
let pinia: ReturnType<typeof createPinia>
let wrapper: VueWrapper | undefined
beforeEach(() => {
  window.history.replaceState(null, '', '#/dashboard?tab=exercises&section=library')
  pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(defaultSettings())
  startExercise.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: { startExercise } })
})
afterEach(() => wrapper?.unmount())

describe('exercise library navigation', () => {
  it('shows readable exercise summaries and starts the selected exercise', async () => {
    wrapper = mount(CatalogLibrary, { global: { plugins: [pinia] } })
    const title = wrapper.get('.exercise-list-item strong').text()
    await wrapper.get('.exercise-list-item').trigger('click')
    expect(window.location.hash).toContain('exercise=')
    expect(wrapper.get('[data-testid="exercise-drawer"]').text()).toContain(title)
    expect(wrapper.get('[data-testid="exercise-drawer"]').text()).toContain('Как выполнять')
    expect(wrapper.get('.exercise-list-item').text()).not.toContain('шанс сейчас')
    await wrapper.get('[data-testid="exercise-drawer"] .primary-action').trigger('click')
    expect(startExercise).toHaveBeenCalledWith({ source: 'catalog', exerciseId: useDashboardNavigation().location.exerciseId })
  })
  it('lets users inspect unavailable exercises but blocks launching until equipment is present', async () => {
    const catalog = useCatalogStore()
    const exercise = catalog.library.find(entry => entry.equipment?.length)!
    useCatalogViewStore().filters.availableNow = false
    useDashboardNavigation().navigate('exercises', 'library', { exerciseId: exercise.id })
    wrapper = mount(CatalogLibrary, { global: { plugins: [pinia] } })
    expect(wrapper.get('[data-testid="exercise-drawer"] .primary-action').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="exercise-drawer"]').text()).toContain('инвентарь')
    useSettingsStore().inventory = { enabled: true, items: [...exercise.equipment!] }
    await nextTick()
    expect(wrapper.get('[data-testid="exercise-drawer"] .primary-action').attributes('disabled')).toBeUndefined()
  })
  it('retains search and list scroll when returning from another section', async () => {
    wrapper = mount(CatalogLibrary, { global: { plugins: [pinia] } })
    await wrapper.get('input[type="search"]').setValue('Плеч')
    const list = wrapper.get('.catalog-scroll').element as HTMLElement
    list.scrollTop = 120
    await wrapper.get('.catalog-scroll').trigger('scroll')
    wrapper.unmount()
    wrapper = mount(CatalogLibrary, { global: { plugins: [pinia] } })
    await flushPromises()
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('Плеч')
    expect((wrapper.get('.catalog-scroll').element as HTMLElement).scrollTop).toBe(120)
  })
})
