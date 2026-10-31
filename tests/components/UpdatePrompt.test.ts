import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import UpdatePromptView from '@/views/UpdatePromptView.vue'
import type { UpdateStatePayload } from '@shared/types/events'

const downloading: UpdateStatePayload = {
  status: 'downloading',
  currentVersion: '0.2.1',
  availableVersion: '0.3.0',
  progressPercent: 42,
  checkedAt: null,
  error: null
}

const ready: UpdateStatePayload = { ...downloading, status: 'ready', progressPercent: 100 }

let updateState: UpdateStatePayload = downloading
let listener: ((state: UpdateStatePayload) => void) | null = null

const getUpdateState = vi.fn(async (): Promise<UpdateStatePayload> => updateState)
const onUpdateState = vi.fn((handler: (state: UpdateStatePayload) => void) => {
  listener = handler
  return () => { listener = null }
})
const installUpdate = vi.fn(async () => ({ started: true, reason: null as 'popup-open' | 'not-ready' | null }))
const dismissUpdatePrompt = vi.fn(async () => undefined)

let wrapper: VueWrapper | null = null

async function settle(): Promise<void> {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
  await nextTick()
}

function findButton(label: string) {
  const button = wrapper!.findAll('button').find(candidate => candidate.text() === label)
  if (!button) throw new Error(`button "${label}" not found`)
  return button
}

beforeEach(() => {
  updateState = downloading
  listener = null
  getUpdateState.mockClear()
  onUpdateState.mockClear()
  installUpdate.mockClear()
  dismissUpdatePrompt.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { getUpdateState, onUpdateState, installUpdate, dismissUpdatePrompt }
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.documentElement.classList.remove('window-popup')
})

describe('UpdatePromptView', () => {
  it('shows the versions, progress and pushed state changes', async () => {
    wrapper = mount(UpdatePromptView)
    await settle()
    expect(wrapper.get('[data-testid="update-version"]').text()).toContain('0.3.0')
    expect(wrapper.get('[data-testid="update-status"]').text()).toContain('42%')

    listener?.({ ...downloading, status: 'ready', progressPercent: 100 })
    await nextTick()
    expect(wrapper.get('[data-testid="update-status"]').text()).toContain('Перезапустите')
  })

  it('restarts into a ready update', async () => {
    updateState = ready
    wrapper = mount(UpdatePromptView)
    await settle()
    await wrapper.get('[data-testid="update-install"]').trigger('click')
    await settle()
    expect(installUpdate).toHaveBeenCalledTimes(1)
  })

  it('explains a refused restart while an exercise popup is open', async () => {
    updateState = ready
    installUpdate.mockResolvedValueOnce({ started: false, reason: 'popup-open' })
    wrapper = mount(UpdatePromptView)
    await settle()
    await wrapper.get('[data-testid="update-install"]').trigger('click')
    await settle()
    expect(wrapper.get('[data-testid="update-error"]').text()).toContain('Открыт попап')
  })

  it('dismisses from «Позже» and from the close button', async () => {
    updateState = ready
    wrapper = mount(UpdatePromptView)
    await settle()

    await findButton('Позже').trigger('click')
    await settle()
    expect(dismissUpdatePrompt).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="update-close"]').trigger('click')
    await settle()
    expect(dismissUpdatePrompt).toHaveBeenCalledTimes(2)
  })

  it('reports a missing preload bridge instead of crashing', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    wrapper = mount(UpdatePromptView)
    await settle()
    expect(wrapper.get('[data-testid="update-error"]').text()).toContain('Не удалось прочитать')
  })
})
