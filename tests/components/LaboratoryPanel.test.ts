import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LaboratoryPanel from '@/debug/LaboratoryPanel.vue'
import AppearancePanel from '@/debug/AppearancePanel.vue'
import { applySnapshot } from '@/bootstrap/hydrate'
import { buildLabScenario, type LabCommand, type LabState } from '@shared/domain/laboratory'
import { setLaboratoryClock } from '@shared/domain/clock'
import { defaultProgress, defaultSettings } from '../../electron/main/persistence/defaults'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { makeSession } from '../fixtures'

const preview = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('@/sounds', () => ({ createSoundPlayer: () => preview }))

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
  preview.play.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: {
    getLabState: async () => state,
    labCommand: command,
    onLabChanged: (handler: (state: LabState) => void) => { listener = handler; return unsubscribe }
  } })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; setLaboratoryClock(); vi.useRealTimers() })

async function panel() {
  wrapper = mount(LaboratoryPanel, { global: { stubs: { CharacterPortrait: true, CalendarHeatmap: true, StatsPanel: true } } })
  await flushPromises()
  return wrapper
}

describe('laboratory controls', () => {
  it('exposes the full preference controls and optional data layers inside the laboratory', async () => {
    const view = await panel()
    await view.findAll('nav button').find(button => button.text() === 'Настройки')!.trigger('click')
    for (const id of ['interval-control', 'severity-controls', 'picker-mode-controls', 'focus-controls', 'inventory-controls', 'ai-controls', 'sound-controls', 'extras-controls', 'weight-controls', 'photo-controls', 'theme-controls']) {
      expect(view.find(`[data-testid="${id}"]`).exists(), id).toBe(true)
    }
    await view.findAll('nav button').find(button => button.text() === 'Данные')!.trigger('click')
    expect(view.find('[data-testid="ai-controls"]').exists()).toBe(true)
    expect(view.find('[data-testid="weight-controls"]').exists()).toBe(true)
    expect(view.find('[data-testid="photo-controls"]').exists()).toBe(true)
  })

  it('passes a specifically selected exercise to main', async () => {
    const view = await panel()
    await view.findAll('nav button').find(button => button.text() === 'Попап и цикл')!.trigger('click')
    await view.get('[aria-label="Упражнение для проверки"]').setValue('neck-tilts')
    await view.findAll('button').find(button => button.text() === 'Обычная разминка')!.trigger('click')
    expect(command).toHaveBeenCalledWith({ action: 'popup', preset: 'normal', exerciseId: 'neck-tilts' })
  })

  it('opens the generated sound package in its own tab without playing anything', async () => {
    const view = await panel()
    await view.findAll('nav button').find(button => button.text() === 'Звуки')!.trigger('click')
    expect(view.find('[data-testid="sound-audition"]').exists()).toBe(true)
    expect(view.find('[data-testid="sound-audition"]').text()).toContain('Голос персонажа')
    expect(preview.play).not.toHaveBeenCalled()
  })

  it('warns when the laboratory profile is muted and enables sound in one click', async () => {
    applySnapshot({ laboratory: { at: state.now, running: false, silent: true },
      settings: { ...defaultSettings(), sound: { ...defaultSettings().sound, enabled: false } },
      progress: defaultProgress(), sessions: [], weights: [] })
    const view = await panel()
    expect(view.get('[data-testid="lab-sound-off"]').text()).toContain('без звука')

    await view.get('[data-testid="lab-sound-off"] button').trigger('click')

    expect(useSettingsStore().sound.enabled).toBe(true)
    expect(view.find('[data-testid="lab-sound-off"]').exists()).toBe(false)
  })

  it('keeps replay silent in the control window and only plays explicit sound previews', async () => {
    const view = await panel()
    listener?.({ ...state, playing: true })
    applySnapshot({ laboratory: { at: state.now, running: false, silent: false }, settings: defaultSettings(),
      progress: defaultProgress(), sessions: [makeSession({ exerciseId: 'neck-tilts' })], weights: [] })
    await flushPromises()
    expect(preview.play).not.toHaveBeenCalled()
    await view.findAll('nav button').find(button => button.text() === 'Попап и цикл')!.trigger('click')
    await view.findAll('button').find(button => button.text() === 'Новая форма')!.trigger('click')
    expect(preview.play).toHaveBeenCalledExactlyOnceWith('stage-up')
  })

  it('can hold and repeat a local reaction without modifying the profile emotion or history', async () => {
    vi.useFakeTimers()
    wrapper = mount(AppearancePanel, { global: { stubs: { CharacterPortrait: true } } })
    await wrapper.get('[aria-label="Удерживать предпросмотр"]').setValue(true)
    await wrapper.get('[data-testid="replay-reaction"]').trigger('click')
    const bubble = wrapper.get('.comic-bubble').element
    vi.advanceTimersByTime(10000)
    expect(wrapper.find('.comic-bubble').exists()).toBe(true)
    await wrapper.get('[data-testid="replay-reaction"]').trigger('click')
    expect(wrapper.get('.comic-bubble').element).not.toBe(bubble)
    expect(useCharacterStore().emotion).toBe('neutral')
    expect(command).not.toHaveBeenCalled()
  })
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
    expect(view.findAll('[aria-label="Персонаж тестового профиля"] option')).toHaveLength(10)
    expect(view.findAll('[data-build]')).toHaveLength(3)
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
    await wrapper.get('[data-preview-stage="5"]').trigger('click')
    expect(command).not.toHaveBeenCalled()
  })
  it('keeps scenarios and explicit manual state controls independently accessible', async () => {
    const view = await panel()
    expect(view.findAll('[data-lab-scenario]')).toHaveLength(6)
    await view.findAll('nav button').find(button => button.text() === 'Ручная проверка')!.trigger('click')
    expect(view.findAll('[data-preview-stage]')).toHaveLength(6)
    expect(view.findAll('[data-preview-condition]')).toHaveLength(4)
    expect(view.findAll('[data-preview-emotion]')).toHaveLength(6)
    expect(view.find('[data-preview-popup="error"]').exists()).toBe(true)
    expect(view.find('[data-testid="open-visual-popup"]').exists()).toBe(true)
  })
  it('preserves manual selections while switching back to scenarios and returning', async () => {
    const view = await panel()
    await view.findAll('nav button').find(button => button.text() === 'Ручная проверка')!.trigger('click')
    await view.get('[data-preview-stage="5"]').trigger('click')
    expect(view.get('.lab-live').attributes('data-manual-stage')).toBe('5')
    await view.findAll('nav button').find(button => button.text() === 'Сценарии')!.trigger('click')
    expect(view.get('.lab-live').attributes('data-manual-stage')).toBeUndefined()
    expect(view.findAll('[data-lab-scenario]')).toHaveLength(6)
    await view.findAll('nav button').find(button => button.text() === 'Ручная проверка')!.trigger('click')
    expect(view.get('[data-preview-stage="5"]').attributes('aria-pressed')).toBe('true')
  })
})
