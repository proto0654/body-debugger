import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import DebugPanel from '@/debug/DebugPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'
import type { DebugApplyScenarioPayload } from '@shared/types/events'
import type { UserProgress } from '@shared/types/progress'
import { makeSettings } from '../fixtures'

const api = {
  openPopup: vi.fn(async () => undefined),
  sessionResult: vi.fn(async () => undefined),
  applyDebugScenario: vi.fn(async (_payload: DebugApplyScenarioPayload) => undefined),
  saveProgress: vi.fn(async (payload: UserProgress) => ({
    settings: makeSettings(),
    progress: payload,
    sessions: [],
    weights: []
  }))
}

function mountPanel(enabled = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(
    makeSettings({ focus: { primary: 'strength', accents: ['mobility'] } })
  )
  useProgressStore().hydrate({
    streak: { current: 2, max: 4 },
    characterStage: 2,
    characterBranch: 'posture',
    characterBuild: 'average',
    exerciseLevels: {},
    focus: { primary: 'strength', accents: ['mobility'] }
  })
  useSessionsStore().hydrate([])

  return mount(DebugPanel, {
    props: { enabled, now: new Date(2026, 9, 30, 12, 0, 0) },
    global: { plugins: [pinia] }
  })
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  api.openPopup.mockClear()
  api.sessionResult.mockClear()
  api.applyDebugScenario.mockClear()
  api.saveProgress.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: api })
})

describe('DebugPanel', () => {
  it('renders nothing outside a dev build', () => {
    wrapper = mountPanel(false)
    expect(wrapper.find('[data-testid="debug-panel"]').exists()).toBe(false)
  })

  it('shows the current character and focus state', () => {
    wrapper = mountPanel()

    expect(wrapper.find('[data-testid="debug-panel"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="debug-stage"]').text()).toContain('2')
    expect(wrapper.get('[data-testid="debug-branch"]').text()).toContain('posture')
    expect(wrapper.get('[data-testid="debug-focus"]').text()).toContain('strength')
  })

  it('applies a scenario through the debug IPC', async () => {
    wrapper = mountPanel()

    await wrapper.get('[data-debug-scenario="steady-week"]').trigger('click')
    await nextTick()

    expect(api.applyDebugScenario).toHaveBeenCalledTimes(1)
    const payload = api.applyDebugScenario.mock.calls[0][0]
    expect(payload.sessions).toHaveLength(7)
    expect(payload.progress.streak.current).toBe(7)
    expect(wrapper.get('[data-testid="debug-status"]').text()).toContain('Стабильная неделя')
  })

  it('triggers a popup and simulates results', async () => {
    wrapper = mountPanel()

    await wrapper.get('[data-testid="debug-trigger"]').trigger('click')
    await wrapper.get('[data-testid="debug-simulate-done"]').trigger('click')
    await nextTick()

    expect(api.openPopup).toHaveBeenCalledTimes(1)
    expect(api.sessionResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', exerciseId: expect.any(String) })
    )
  })

  it('clears history with an explicit reset', async () => {
    wrapper = mountPanel()

    await wrapper.get('[data-testid="debug-reset"]').trigger('click')
    await nextTick()

    const payload = api.applyDebugScenario.mock.calls[0][0]
    expect(payload.sessions).toEqual([])
    expect(payload.progress.characterStage).toBe(0)
    expect(payload.progress.streak).toEqual({ current: 0, max: 0 })
  })

  it('forces stage, branch and build through progress persistence', async () => {
    wrapper = mountPanel()

    await wrapper.get('[data-debug-stage="5"]').trigger('click')
    await wrapper.get('[data-debug-branch="power"]').trigger('click')
    await wrapper.get('[data-debug-build="stocky"]').trigger('click')
    await nextTick()

    expect(api.saveProgress).toHaveBeenCalledTimes(3)
    expect(api.saveProgress.mock.calls[0][0]).toMatchObject({ characterStage: 5 })
    expect(api.saveProgress.mock.calls[1][0]).toMatchObject({ characterBranch: 'power' })
    expect(api.saveProgress.mock.calls[2][0]).toMatchObject({ characterBuild: 'stocky' })
  })

  it('forces a character emotion locally', async () => {
    wrapper = mountPanel()

    await wrapper.get('[data-debug-emotion="proud"]').trigger('click')
    expect(wrapper.get('[data-testid="debug-emotion"]').text()).toContain('proud')
  })
})
