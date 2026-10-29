import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import PopupView from '@/views/PopupView.vue'
import { POPUP_EXIT_MS } from '@/motion'
import { useCharacterStore } from '@/stores/character'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import type { SeverityLevel } from '@shared/types/settings'
import { makeExercise, makeSettings } from '../fixtures'

const api = {
  sessionResult: vi.fn(async () => undefined),
  closePopup: vi.fn(async () => undefined)
}

/** Resolves a chain of microtasks while fake timers are active. */
async function flushMicrotasks(): Promise<void> {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
  await nextTick()
}

function findButton(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === label)
  if (!button) throw new Error(`button "${label}" not found`)
  return button
}

function mountPopup(options: { severity?: SeverityLevel; reduceMotion?: boolean } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(
    makeSettings({
      severity: options.severity ?? 'soft',
      reduceMotion: options.reduceMotion ?? false
    })
  )
  useSessionsStore().beginSession(
    makeExercise({ id: 'neck-circles', durationSec: 30 }),
    'session-1'
  )
  return mount(PopupView, { global: { plugins: [pinia] } })
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  api.sessionResult.mockClear()
  api.closePopup.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: api })
  vi.useFakeTimers()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('PopupView — done flow', () => {
  it('reports the result, plays the exit animation and closes the window', async () => {
    wrapper = mountPopup()
    const done = findButton(wrapper, 'Готово')

    await done.trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', exerciseId: 'neck-circles', status: 'done' })
    )
    expect(useCharacterStore().emotion).toBe('happy')
    expect(wrapper.classes()).toContain('popup-out-done')
    expect(wrapper.find('.popup-flash').exists()).toBe(true)
    expect(api.closePopup).not.toHaveBeenCalled()

    vi.advanceTimersByTime(POPUP_EXIT_MS.done)
    await flushMicrotasks()
    expect(api.closePopup).toHaveBeenCalledTimes(1)
  })

  it('ignores a second click while the first one is in flight', async () => {
    wrapper = mountPopup()
    const done = findButton(wrapper, 'Готово')

    void done.trigger('click')
    void done.trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledTimes(1)
  })

  it('closes immediately when reduced motion is on', async () => {
    wrapper = mountPopup({ reduceMotion: true })
    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledTimes(1)
    expect(api.closePopup).toHaveBeenCalledTimes(1)
    expect(wrapper.classes()).not.toContain('popup-out-done')
    expect(wrapper.find('.popup-flash').exists()).toBe(false)
  })
})

describe('PopupView — severity gate', () => {
  it('keeps «Готово» locked on medium until 80% of the timer', async () => {
    wrapper = mountPopup({ severity: 'medium' })
    const done = findButton(wrapper, 'Готово')
    expect(done.attributes('disabled')).toBeDefined()

    vi.advanceTimersByTime(24_000)
    await nextTick()

    expect(done.attributes('disabled')).toBeUndefined()
  })

  it('unlocks «Готово» immediately on soft', () => {
    wrapper = mountPopup({ severity: 'soft' })
    expect(findButton(wrapper, 'Готово').attributes('disabled')).toBeUndefined()
  })
})

describe('PopupView — skip flow', () => {
  it('records a skip, shows the tired face and fades out quietly', async () => {
    wrapper = mountPopup()
    await findButton(wrapper, 'Пропустить').trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    )
    expect(useCharacterStore().emotion).toBe('tired')
    expect(wrapper.classes()).toContain('popup-out-quiet')
    expect(wrapper.find('.popup-flash').exists()).toBe(false)

    vi.advanceTimersByTime(POPUP_EXIT_MS.quiet)
    await flushMicrotasks()
    expect(api.closePopup).toHaveBeenCalledTimes(1)
  })
})
