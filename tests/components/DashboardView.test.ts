import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import DashboardView from '@/views/DashboardView.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'
import { useCharacterStore } from '@/stores/character'
import { makeSession, makeSettings } from '../fixtures'
import type { DataSnapshot } from '@shared/types/persistence'
import type { AppSettings } from '@shared/types/settings'
import type { Session } from '@shared/types/session'

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

function mountDashboard(history: Session[] = []): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(makeSettings())
  useSessionsStore().hydrate(history)
  return mount(DashboardView, { global: { plugins: [pinia] } })
}

async function clickIn(wrapper: VueWrapper, testId: string, label: string): Promise<void> {
  if (!wrapper.find(`[data-testid="${testId}"]`).exists()) {
    await wrapper.findAll('nav button').find(button => button.text() === 'Настройки')!.trigger('click')
  }
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
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  window.location.hash = ''
})

describe('DashboardView — optional layers', () => {
  it('shows the proud portrait when a new day extends an existing streak', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 30, 12))
    const prior = Array.from({ length: 6 }, (_, index) => makeSession({
      exerciseId: 'neck-tilts', completedAt: new Date(2026, 9, 29 - index, 12).toISOString()
    }))
    wrapper = mountDashboard(prior)
    useSessionsStore().hydrate([...prior, makeSession({ exerciseId: 'neck-tilts', completedAt: new Date().toISOString() })])
    await nextTick()
    expect(wrapper.get('[data-testid="character-scene"] img').attributes('src')).toMatch(/emotion-proud-average/)
    expect(wrapper.get('.hero-speech').attributes('data-tone')).toBe('milestone')
  })

  it('shows a large emotional portrait and a comic caption on completion, then restores the body', async () => {
    vi.useFakeTimers()
    wrapper = mountDashboard()
    const scene = wrapper.get('[data-testid="character-scene"]')
    expect(scene.get('img').attributes('src')).toMatch(/stage-0-average/)
    useSessionsStore().hydrate([makeSession({ exerciseId: 'neck-tilts', completedAt: new Date().toISOString() })])
    await nextTick()
    expect(scene.get('img').attributes('src')).toMatch(/emotion-happy-average/)
    expect(wrapper.get('.hero-speech').text()).toBe(useCharacterStore().reaction.caption)
    expect(wrapper.get('.hero-speech').attributes('data-tone')).toBe('cheer')
    vi.advanceTimersByTime(3500)
    await nextTick()
    expect(scene.get('img').attributes('src')).toMatch(/stage-0-average/)
    expect(wrapper.get('.hero-speech').attributes('data-tone')).toBe('calm')
  })

  it('keeps a skipped session calm without switching to a punitive portrait', async () => {
    wrapper = mountDashboard()
    useSessionsStore().hydrate([makeSession({ exerciseId: 'neck-tilts', status: 'skipped' })])
    await nextTick()
    expect(useCharacterStore().emotion).toBe('neutral')
    expect(wrapper.get('.hero-speech').attributes('data-tone')).toBe('calm')
    expect(wrapper.get('[data-testid="character-scene"] img').attributes('src')).toMatch(/stage-0-average/)
  })

  it('keeps today focused on the character and the next attainable form', () => {
    wrapper = mountDashboard()
    expect(wrapper.find('[data-testid="today-hero"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="character-journey"]').text()).toContain('Ещё 3 разминки')
    expect(wrapper.find('[data-testid="inventory-controls"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('JSON')
  })

  it('refreshes day counts and streak after midnight without a new session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 30, 23, 59, 50))
    wrapper = mountDashboard()
    useSessionsStore().hydrate([makeSession({ exerciseId: 'neck-tilts', completedAt: new Date(2026, 9, 30, 12).toISOString() })])
    await nextTick()
    expect(wrapper.get('[data-testid="today-count"] strong').text()).toBe('1')
    vi.advanceTimersByTime(30_000)
    await nextTick()
    expect(wrapper.get('[data-testid="today-count"] strong').text()).toBe('0')
    vi.advanceTimersByTime(86_400_000)
    await nextTick()
    expect(wrapper.get('[data-testid="current-streak"] strong').text()).toBe('0')
  })

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
    await wrapper.findAll('nav button').find(button => button.text() === 'Сегодня')!.trigger('click')
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
