import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import PreferencesPanel from '@/components/settings/PreferencesPanel.vue'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { makeSettings } from '../fixtures'
import type { DataSnapshot } from '@shared/types/persistence'
import type { UserProgress } from '@shared/types/progress'
import type { AppSettings } from '@shared/types/settings'

const progress: UserProgress = {
  streak: { current: 0, max: 0 },
  characterStage: 0,
  characterBranch: 'neutral',
  characterBuild: 'average',
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

const saveSettings = vi.fn(
  async (settings: AppSettings): Promise<DataSnapshot> => ({
    settings,
    progress,
    sessions: [],
    weights: []
  })
)
const saveProgress = vi.fn(
  async (next: UserProgress): Promise<DataSnapshot> => ({
    settings: makeSettings(),
    progress: next,
    sessions: [],
    weights: []
  })
)

function mountPanel(): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(makeSettings())
  useProgressStore().hydrate(progress)
  return mount(PreferencesPanel, { global: { plugins: [pinia] } })
}

async function settle(): Promise<void> {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
  await nextTick()
}

async function click(wrapper: VueWrapper, selector: string): Promise<void> {
  await wrapper.get(selector).trigger('click')
  await settle()
}

beforeEach(() => {
  saveSettings.mockClear()
  saveProgress.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { saveSettings, saveProgress }
  })
})

describe('PreferencesPanel', () => {
  it('renders the four preference groups from the stored state', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="preferences-panel"]').exists()).toBe(true)
    expect((wrapper.get('[data-testid="interval-input"]').element as HTMLInputElement).value).toBe(
      '45'
    )
    expect(wrapper.get('[data-picker-mode="balance"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-focus-primary="none"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-build="average"]').attributes('aria-pressed')).toBe('true')
  })

  it('saves a quick interval preset', async () => {
    const wrapper = mountPanel()

    await click(wrapper, '[data-interval-preset="90"]')

    expect(saveSettings.mock.calls[0][0].intervalMinutes).toBe(90)
    expect(wrapper.get('[data-interval-preset="90"]').attributes('aria-pressed')).toBe('true')
  })

  it('saves a typed interval and reverts an invalid one', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('[data-testid="interval-input"]')

    await input.setValue('30')
    await input.trigger('change')
    await settle()
    expect(saveSettings.mock.calls[0][0].intervalMinutes).toBe(30)

    await input.setValue('500')
    await input.trigger('change')
    await settle()
    expect(saveSettings).toHaveBeenCalledTimes(1)
    expect((input.element as HTMLInputElement).value).toBe('30')
  })

  it('saves the picker mode', async () => {
    const wrapper = mountPanel()

    await click(wrapper, '[data-picker-mode="push"]')

    expect(saveSettings.mock.calls[0][0].pickerMode).toBe('push')
    expect(wrapper.get('[data-picker-mode="push"]').attributes('aria-pressed')).toBe('true')
  })

  it('sets the primary direction and clears it on a second click', async () => {
    const wrapper = mountPanel()

    await click(wrapper, '[data-focus-primary="strength"]')
    expect(saveSettings.mock.calls[0][0].focus).toEqual({ primary: 'strength', accents: [] })

    await click(wrapper, '[data-focus-primary="strength"]')
    expect(saveSettings.mock.calls[1][0].focus).toEqual({ primary: null, accents: [] })
  })

  it('toggles accents and disables the one used as the primary', async () => {
    const wrapper = mountPanel()

    await click(wrapper, '[data-focus-primary="strength"]')
    expect(wrapper.get('[data-focus-accent="strength"]').attributes('disabled')).toBeDefined()

    await click(wrapper, '[data-focus-accent="strength"]')
    expect(saveSettings).toHaveBeenCalledTimes(1)

    await click(wrapper, '[data-focus-accent="mobility"]')
    expect(saveSettings.mock.calls[1][0].focus).toEqual({
      primary: 'strength',
      accents: ['mobility']
    })
    expect(wrapper.get('[data-focus-accent="mobility"]').attributes('aria-pressed')).toBe('true')

    await click(wrapper, '[data-focus-accent="mobility"]')
    expect(saveSettings.mock.calls[2][0].focus).toEqual({ primary: 'strength', accents: [] })
  })

  it('saves the character build through the progress store', async () => {
    const wrapper = mountPanel()

    await click(wrapper, '[data-build="stocky"]')

    expect(saveProgress.mock.calls[0][0].characterBuild).toBe('stocky')
    expect(wrapper.get('[data-build="stocky"]').attributes('aria-pressed')).toBe('true')
  })
})
