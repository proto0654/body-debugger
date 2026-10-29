import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import WeightCard from '@/components/weight/WeightCard.vue'
import { useSettingsStore } from '@/stores/settings'
import { useWeightStore } from '@/stores/weight'
import { makeSettings } from '../fixtures'
import type { DataSnapshot } from '@shared/types/persistence'
import type { WeightEntry } from '@shared/types/weight'

const progress = {
  streak: { current: 0, max: 0 },
  characterStage: 0 as const,
  characterBranch: 'neutral' as const,
  characterBuild: 'average' as const,
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

const DAY_MS = 86_400_000

function entries(): WeightEntry[] {
  return [
    { id: 'w1', at: new Date(Date.now() - 5 * DAY_MS).toISOString(), weightKg: 74 },
    { id: 'w2', at: new Date().toISOString(), weightKg: 72.5 }
  ]
}

function snapshot(weights: WeightEntry[]): DataSnapshot {
  return { settings: makeSettings({ weight: { enabled: true, targetKg: null } }), progress, sessions: [], weights }
}

const addWeight = vi.fn(async (_payload: { weightKg: number; at?: string }) =>
  snapshot(entries())
)
const removeWeight = vi.fn(async (_payload: { id: string }) => snapshot(entries().slice(0, 1)))
const saveSettings = vi.fn(async (settings: DataSnapshot['settings']) => ({
  ...snapshot(entries()),
  settings
}))

let wrapper: VueWrapper | null = null

function mountCard(): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)

  useSettingsStore().hydrate(makeSettings({ weight: { enabled: true, targetKg: null } }))
  useWeightStore().hydrate(entries())

  return mount(WeightCard, { global: { plugins: [pinia] } })
}

beforeEach(() => {
  addWeight.mockClear()
  removeWeight.mockClear()
  saveSettings.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { addWeight, removeWeight, saveSettings }
  })
})

describe('WeightCard', () => {
  it('shows the latest weight and the change across the window', () => {
    wrapper = mountCard()

    expect(wrapper.find('[data-testid="weight-latest"]').text()).toContain('72.5')
    expect(wrapper.find('[data-testid="weight-change"]').text()).toContain('−1.5 кг')
    expect(wrapper.find('[data-testid="weight-chart"] polyline').attributes('points')).toBeTruthy()
  })

  it('rejects an out-of-range value without calling main', async () => {
    wrapper = mountCard()
    await wrapper.find('[data-testid="weight-input"]').setValue('5')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(addWeight).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="weight-error"]').text()).toContain('от 20 до 300')
  })

  it('stores a valid measurement and clears the input', async () => {
    wrapper = mountCard()
    const input = wrapper.find('[data-testid="weight-input"]')
    await input.setValue('73.1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(addWeight).toHaveBeenCalledWith({ weightKg: 73.1, at: undefined })
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-testid="weight-error"]').exists()).toBe(false)
  })

  it('commits the goal on blur', async () => {
    wrapper = mountCard()
    const target = wrapper.find('[data-testid="weight-target"]')
    await target.setValue('70')
    await target.trigger('blur')
    await flushPromises()

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ weight: { enabled: true, targetKg: 70 } })
    )
    expect(wrapper.find('[data-testid="weight-target-gap"]').text()).toContain('Цель 70 кг')
  })

  it('deletes an entry through the store', async () => {
    wrapper = mountCard()
    const remove = wrapper.find('button[aria-label="Удалить запись 72.5 кг"]')
    await remove.trigger('click')
    await flushPromises()

    expect(removeWeight).toHaveBeenCalledWith({ id: 'w2' })
  })
})
