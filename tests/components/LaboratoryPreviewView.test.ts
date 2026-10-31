import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LaboratoryPreviewView from '@/views/LaboratoryPreviewView.vue'
import type { LabState, LabCommand } from '@shared/domain/laboratory'
import type { LabVisualPreview } from '@shared/domain/laboratory-preview'

let view: VueWrapper | undefined
let listener: (state: LabState) => void
const preview: LabVisualPreview = { packId: 'engineer', stage: 4, build: 'lean', branch: 'mobility', condition: 2,
  emotion: 'neutral', popup: 'ready', sequence: 0 }
const state = { enabled: true, plan: null, cursor: 0, playing: false, detached: false, interrupted: false,
  now: '2026-10-30T09:00:00Z', activePopup: false, message: '', visualPreview: preview } satisfies LabState
const command = vi.fn(async (_value: LabCommand) => state)
const unsubscribe = vi.fn()
beforeEach(() => {
  command.mockClear(); unsubscribe.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: {
    getLabState: async () => state, labCommand: command,
    onLabChanged: (callback: typeof listener) => { listener = callback; return unsubscribe }
  } })
})
afterEach(() => { view?.unmount(); view = undefined })

describe('native visual preview', () => {
  it('follows manual changes and uses preview commands for its buttons instead of session results', async () => {
    view = mount(LaboratoryPreviewView)
    await flushPromises()
    expect(view.get('[data-testid="popup-preview"]').attributes('data-state')).toBe('ready')
    await view.findAll('button').find(button => button.text() === 'Начать')!.trigger('click')
    await flushPromises()
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ action: 'visual-preview', preview: expect.objectContaining({ popup: 'active', emotion: 'focused' }) }))
    listener({ ...state, visualPreview: { ...preview, popup: 'done', emotion: 'happy' } })
    await flushPromises()
    await view.get('[data-testid="close-result"]').trigger('click')
    await flushPromises()
    expect(command).toHaveBeenLastCalledWith({ action: 'close-preview' })
    view.unmount(); view = undefined
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
