import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import DashboardView from '@/views/DashboardView.vue'
import { useSettingsStore } from '@/stores/settings'
import { makeSettings } from '../fixtures'
import type { DataSnapshot } from '@shared/types/persistence'
import type { AppSettings } from '@shared/types/settings'

const progress = {
  streak: { current: 3, max: 5 },
  characterStage: 2 as const,
  characterBranch: 'posture' as const,
  characterBuild: 'average' as const,
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

function snapshot(settings: AppSettings): DataSnapshot {
  return { settings, progress, sessions: [], weights: [] }
}

const saveSettings = vi.fn(async (settings: AppSettings) => snapshot(settings))
const openPopup = vi.fn(async () => undefined)
const listPhotos = vi.fn(async () => [])
const listCustomExercises = vi.fn(async () => [])

function mountDashboard(): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(makeSettings())
  return mount(DashboardView, { global: { plugins: [pinia] } })
}

async function clickIn(wrapper: VueWrapper, testId: string, label: string): Promise<void> {
  const controls = wrapper.get(`[data-testid="${testId}"]`)
  const button = controls
    .findAll('button')
    .find((candidate) => candidate.text().trim() === label)
  if (!button) throw new Error(`button "${label}" not found in ${testId}`)
  await button.trigger('click')
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
  await nextTick()
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  saveSettings.mockClear()
  openPopup.mockClear()
  listPhotos.mockClear()
  listCustomExercises.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { saveSettings, openPopup, listPhotos, listCustomExercises }
  })
})

afterEach(() => {
  window.location.hash = ''
})

describe('DashboardView — optional layers', () => {
  it('turns sounds on and reveals the volume slider', async () => {
    wrapper = mountDashboard()
    expect(wrapper.find('[data-testid="sound-volume"]').exists()).toBe(false)

    await clickIn(wrapper, 'sound-controls', 'Вкл')

    expect(saveSettings.mock.calls[0][0].sound.enabled).toBe(true)
    expect(wrapper.find('[data-testid="sound-volume"]').exists()).toBe(true)
  })

  it('turns the inventory on and shows the equipment chips', async () => {
    wrapper = mountDashboard()

    await clickIn(wrapper, 'inventory-controls', 'Вкл')

    expect(saveSettings.mock.calls[0][0].inventory.enabled).toBe(true)
    expect(wrapper.get('[data-testid="inventory-items"]').text()).toContain('Мешок 50 кг')
  })

  it('switches the theme', async () => {
    wrapper = mountDashboard()

    await clickIn(wrapper, 'theme-controls', 'Полночь')

    expect(saveSettings.mock.calls[0][0].themeId).toBe('night')
  })

  it('turns photos on and renders the gallery card', async () => {
    wrapper = mountDashboard()

    await clickIn(wrapper, 'photo-controls', 'Вкл')

    expect(saveSettings.mock.calls[0][0].photos.enabled).toBe(true)
    expect(listPhotos).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="photo-gallery"]').text()).toContain('Фото пока нет')
  })

  it('turns AI proposals on and mounts the panel', async () => {
    wrapper = mountDashboard()

    await clickIn(wrapper, 'ai-controls', 'Вкл')

    expect(saveSettings.mock.calls[0][0].ai.enabled).toBe(true)
    expect(wrapper.find('[data-testid="ai-panel"]').exists()).toBe(true)
    expect(listCustomExercises).toHaveBeenCalled()
  })

  it('renders the calendar heatmap and the stats panel', async () => {
    wrapper = mountDashboard()
    const nav = wrapper.findAll('nav button')

    await nav.find((button) => button.text() === 'Календарь')!.trigger('click')
    expect(wrapper.find('[data-testid="calendar-heatmap"]').exists()).toBe(true)

    await nav.find((button) => button.text() === 'Статистика')!.trigger('click')
    expect(wrapper.find('[data-testid="stats-panel"]').exists()).toBe(true)
  })

  it('opens the preferences tab', async () => {
    wrapper = mountDashboard()
    const nav = wrapper.findAll('nav button')

    await nav.find((button) => button.text() === 'Настройки')!.trigger('click')

    expect(wrapper.find('[data-testid="preferences-panel"]').exists()).toBe(true)
  })

  it('opens the tab requested in the hash', () => {
    window.location.hash = '#/dashboard?tab=settings'
    wrapper = mountDashboard()

    expect(wrapper.find('[data-testid="preferences-panel"]').exists()).toBe(true)
  })
})
