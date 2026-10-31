import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import AppearancePanel from '@/debug/AppearancePanel.vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'
import type { LabCommand } from '@shared/domain/laboratory'
import type { LabVisualPreview } from '@shared/domain/laboratory-preview'

const command = vi.fn(async (_command: LabCommand) => ({}))
let view: VueWrapper | undefined
beforeEach(() => {
  setActivePinia(createPinia())
  command.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: { labCommand: command } })
})
afterEach(() => { view?.unmount(); view = undefined; vi.useRealTimers() })

describe('manual character and popup state inspection', () => {
  it('clicks every form and condition and keeps build, branch and emotion independent of the saved profile', async () => {
    view = mount(AppearancePanel)
    const body = () => view!.findAllComponents(CharacterPortrait).find(component => component.attributes('data-testid') === 'manual-body')!
    const face = () => view!.findAllComponents(CharacterPortrait).find(component => component.attributes('data-testid') === 'manual-face')!
    for (let stage = 0; stage < 6; stage++) {
      await view.get(`[data-preview-stage="${stage}"]`).trigger('click')
      expect(body().props('stage')).toBe(stage)
    }
    for (let level = 0; level < 4; level++) {
      await view.get(`[data-preview-condition="${level}"]`).trigger('click')
      expect(body().props('condition')).toBe(level)
      expect(body().props('stage')).toBe(5)
    }
    await view.get('[data-preview-build="stocky"]').trigger('click')
    await view.get('[data-preview-branch="power"]').trigger('click')
    await view.get('[data-preview-emotion="tired"]').trigger('click')
    expect(body().props()).toMatchObject({ stage: 5, condition: 3, build: 'stocky', branch: 'power' })
    expect(face().props('emotion')).toBe('tired')
    expect(useProgressStore().characterStage).toBe(0)
    expect(useProgressStore().characterBuild).toBe('average')
    expect(useCharacterStore().emotion).toBe('neutral')
    expect(useSessionsStore().history).toEqual([])
    expect(command).not.toHaveBeenCalled()
  })

  it('clicks the inline popup cycle, success and error states without saving a result', async () => {
    view = mount(AppearancePanel)
    const popup = () => view!.get('[data-testid="popup-preview"]')
    await popup().findAll('button').find(button => button.text() === 'Начать')!.trigger('click')
    expect(popup().attributes('data-state')).toBe('active')
    await popup().findAll('button').find(button => button.text() === 'Готово')!.trigger('click')
    expect(popup().attributes('data-state')).toBe('done')
    await popup().get('[data-testid="close-result"]').trigger('click')
    expect(popup().attributes('data-state')).toBe('ready')
    await view.get('[data-preview-popup="error"]').trigger('click')
    expect(popup().get('[role="alert"]').text()).toContain('Не удалось сохранить')
    await view.get('[data-preview-popup="snoozed"]').trigger('click')
    expect(popup().get('[data-result]').attributes('data-result')).toBe('quiet')
    expect(command).not.toHaveBeenCalled()
    expect(useSessionsStore().history).toEqual([])
  })

  it('wraps forms in both directions and keeps manually selected states held by default', async () => {
    vi.useFakeTimers()
    view = mount(AppearancePanel)
    await view.get('[aria-label="Предыдущая форма"]').trigger('click')
    expect(view.get('[data-preview-stage="5"]').attributes('aria-pressed')).toBe('true')
    await view.get('[aria-label="Следующая форма"]').trigger('click')
    expect(view.get('[data-preview-stage="0"]').attributes('aria-pressed')).toBe('true')
    await view.get('[data-preview-popup="stage-up"]').trigger('click')
    vi.advanceTimersByTime(30000)
    expect(view.get('[data-testid="popup-preview"]').attributes('data-state')).toBe('stage-up')
  })

  it('updates an open native preview with manual overrides and accepts state changes from its buttons', async () => {
    view = mount(AppearancePanel)
    await view.get('[data-preview-stage="5"]').trigger('click')
    await view.get('[data-preview-popup="done"]').trigger('click')
    await view.get('[data-testid="open-visual-popup"]').trigger('click')
    await flushPromises()
    const request = command.mock.calls[0]![0] as Extract<LabCommand, { action: 'visual-preview' }>
    expect(request).toMatchObject({ action: 'visual-preview', open: true, preview: { stage: 5, popup: 'done' } })
    await view.setProps({ nativePreview: request.preview })
    await view.get('[data-preview-condition="3"]').trigger('click')
    await flushPromises()
    expect(command.mock.calls.at(-1)![0]).toMatchObject({ action: 'visual-preview', open: false, preview: { condition: 3, stage: 5 } })
    const remote: LabVisualPreview = { ...request.preview, popup: 'skipped', emotion: 'neutral', sequence: 10 }
    await view.setProps({ nativePreview: remote })
    await flushPromises()
    expect(view.get('[data-preview-popup="skipped"]').attributes('aria-pressed')).toBe('true')
    expect(view.get('[data-testid="popup-preview"]').attributes('data-state')).toBe('skipped')
  })
})
