import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LaboratoryPanel from '@/debug/LaboratoryPanel.vue'
import AppearancePanel from '@/debug/AppearancePanel.vue'
import { applySnapshot } from '@/bootstrap/hydrate'
import { buildLabScenario, type LabCommand, type LabState } from '@shared/domain/laboratory'
import { setLaboratoryClock } from '@shared/domain/clock'
import { defaultProgress, defaultSettings } from '../../electron/main/persistence/defaults'

let wrapper: VueWrapper | undefined
let listener: ((state: LabState) => void) | undefined
const unsubscribe = vi.fn()
const command = vi.fn(async (_command: LabCommand) => state)
let state: LabState

beforeEach(() => {
  setActivePinia(createPinia())
  state = { enabled: true, plan: null, cursor: 0, playing: false, interrupted: false, detached: false,
    now: '2026-10-30T09:00:00Z', activePopup: false, message: 'Выберите историю' }
  applySnapshot({ laboratory: { at: state.now, running: false, silent: true },
    settings: defaultSettings(), progress: defaultProgress(), sessions: [], weights: [] })
  command.mockClear(); unsubscribe.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: {
    getLabState: async () => state,
    labCommand: command,
    onLabChanged: (handler: (state: LabState) => void) => { listener = handler; return unsubscribe }
  } })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; setLaboratoryClock() })

async function panel() {
  wrapper = mount(LaboratoryPanel, { global: { stubs: { CharacterPortrait: true, CalendarHeatmap: true, StatsPanel: true } } })
  await flushPromises()
  return wrapper
}

describe('laboratory controls', () => {
  it('loads six stories and sends a scenario command without renderer-owned history writes', async () => {
    const view = await panel()
    expect(view.findAll('[data-lab-scenario]')).toHaveLength(6)
    await view.get('[data-lab-scenario="recovery"]').trigger('click')
    expect(command).toHaveBeenCalledWith({ action: 'scenario', id: 'recovery' })
  })
  it('responds to another window and seeks backwards through main', async () => {
    const view = await panel()
    state = { ...state, plan: buildLabScenario('growth', new Date(2026, 9, 30), defaultSettings(), defaultProgress()), cursor: 12 }
    listener?.(state)
    await flushPromises()
    expect(view.find('[data-testid="lab-timeline"]').exists()).toBe(true)
    await view.get('[aria-label="Шаг назад"]').trigger('click')
    expect(command).toHaveBeenCalledWith({ action: 'step', direction: -1, unit: 'event' })
  })
  it('switches to real popup controls and sends the selected strictness preset', async () => {
    const view = await panel()
    await view.findAll('nav button')[1]!.trigger('click')
    const button = view.findAll('button').find(button => button.text() === 'Hardcore · удержание')!
    await button.trigger('click')
    expect(command).toHaveBeenCalledWith({ action: 'popup', preset: 'hardcore' })
  })
  it('keeps the primary play action, identity picker and dynamics discoverable before choosing a history', async () => {
    const view = await panel()
    expect(view.get('[data-testid="lab-console"] [data-testid="lab-play"]').text()).toContain('Проиграть сценарий')
    expect(view.findAll('[data-character-pack]')).toHaveLength(10)
    expect(view.find('[data-testid="lab-dynamics"]').exists()).toBe(true)
  })
  it('shows command errors and releases controls for retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    command.mockRejectedValueOnce(new Error('invalid seed'))
    const view = await panel()
    await view.get('[data-lab-scenario="growth"]').trigger('click')
    await flushPromises()
    expect(view.get('[role="alert"]').text()).toContain('Действие не выполнено')
    expect(view.get('[data-lab-scenario="growth"]').attributes('disabled')).toBeUndefined()
  })
  it('unsubscribes without stopping playback owned by main when a view closes', async () => {
    await panel()
    wrapper?.unmount(); wrapper = undefined
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(command).not.toHaveBeenCalled()
  })
  it('keeps appearance overrides local', async () => {
    wrapper = mount(AppearancePanel, { global: { stubs: { CharacterPortrait: true } } })
    await wrapper.findAll('select')[0]!.setValue(5)
    expect(command).not.toHaveBeenCalled()
  })
})
