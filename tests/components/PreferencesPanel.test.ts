import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import CharacterSettingsPanel from '@/components/character/CharacterSettingsPanel.vue'
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

function mountPanel(character = false): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(makeSettings())
  useProgressStore().hydrate(progress)
  return mount(character ? CharacterSettingsPanel : PreferencesPanel, { global: { plugins: [pinia] } })
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
  it('rolls back a failed build save and allows retry from the shared character panel', async () => {
    const wrapper = mountPanel(true)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    saveProgress.mockRejectedValueOnce(new Error('disk full'))
    await click(wrapper, '[data-build="stocky"]')
    expect(wrapper.get('[data-build="average"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить телосложение')
    await click(wrapper, '[data-build="stocky"]')
    expect(wrapper.get('[data-build="stocky"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
  it('persists the chosen identity and rolls back a failed save so retry remains possible', async () => {
    const wrapper = mountPanel(true)
    expect(wrapper.findAll('[data-character-pack]')).toHaveLength(10)
    await click(wrapper, '[data-character-pack="engineer"]')
    expect(saveSettings.mock.calls.at(-1)![0].characterPackId).toBe('engineer')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    saveSettings.mockRejectedValueOnce(new Error('disk full'))
    await click(wrapper, '[data-character-pack="hipster"]')
    expect(wrapper.get('[data-character-pack="engineer"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить')
    await click(wrapper, '[data-character-pack="hipster"]')
    expect(wrapper.get('[data-character-pack="hipster"]').attributes('aria-pressed')).toBe('true')
  })
  it('groups rhythm, strictness and exercise selection together', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="preferences-panel"]').exists()).toBe(true)
    expect((wrapper.get('[data-testid="interval-input"]').element as HTMLInputElement).value).toBe(
      '45'
    )
    expect(wrapper.get('[data-picker-mode="balance"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="focus-zone-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="focus-method-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="limitations-controls"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="severity-controls"]').text()).toContain('Средняя')
    expect(wrapper.find('[data-testid="inventory-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-character-pack]').exists()).toBe(false)
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

  it('cycles Focus V2 zone levels', async () => {
    const wrapper = mountPanel()
    const upper = wrapper.get('[data-testid="focus-zone-controls"] button')

    await click(wrapper, '[data-testid="focus-zone-controls"] button')
    expect(saveSettings.mock.calls[0][0].focusV2.zones.upper).toBe(1)
    expect(upper.attributes('aria-label')).toContain('+')

    await click(wrapper, '[data-testid="focus-zone-controls"] button')
    expect(saveSettings.mock.calls[1][0].focusV2.zones.upper).toBe(2)
  })

  it('toggles a limitation chip', async () => {
    const wrapper = mountPanel()

    await click(wrapper, '[data-testid="limitations-controls"] button')
    expect(saveSettings.mock.calls[0][0].limitations).toEqual(['neck'])
    expect(
      wrapper.get('[data-testid="limitations-controls"] button').attributes('aria-pressed')
    ).toBe('true')

    await click(wrapper, '[data-testid="limitations-controls"] button')
    expect(saveSettings.mock.calls[1][0].limitations).toEqual([])
  })

  it('saves the character build through the progress store', async () => {
    const wrapper = mountPanel(true)

    await click(wrapper, '[data-build="stocky"]')

    expect(saveProgress.mock.calls[0][0].characterBuild).toBe('stocky')
    expect(wrapper.get('[data-build="stocky"]').attributes('aria-pressed')).toBe('true')
  })
})
