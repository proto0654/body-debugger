import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import PopupView from '@/views/PopupView.vue'
import { POPUP_EXIT_MS } from '@/motion'
import {
  POPUP_EXTRAS_COLLAPSED_HEIGHT,
  POPUP_EXTRAS_HEIGHT
} from '@shared/constants/popup'
import { useRuntimeStore } from '@/stores/runtime'
import { nowMs, setLaboratoryClock } from '@shared/domain/clock'
import type { LabDriverCommand } from '@shared/domain/laboratory-playback'
import { useCharacterStore } from '@/stores/character'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import type { SeverityLevel } from '@shared/types/settings'
import type { SessionResultPayload } from '@shared/types/events'
import { makeExercise, makeSession, makeSettings } from '../fixtures'

const soundPlayer = vi.hoisted(() => ({ play: vi.fn(), preload: vi.fn() }))

vi.mock('@/sounds', () => ({
  useSoundPlayer: () => soundPlayer
}))

const photoEntry = {
  id: 'photo-1',
  fileName: 'photo-1.png',
  mimeType: 'image/png',
  sizeBytes: 2,
  createdAt: '2026-10-30T09:00:00.000Z',
  sessionId: 'session-1'
}

const api = {
  sessionResult: vi.fn(async (_payload: SessionResultPayload) => ({ saved: true })),
  closePopup: vi.fn(async () => undefined),
  resizePopup: vi.fn(async () => undefined),
  addPhoto: vi.fn(async () => photoEntry),
  removePhoto: vi.fn(async () => ({ removed: true, photos: [] })),
  listPhotos: vi.fn(async () => [photoEntry])
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

async function mountPopup(
  options: {
    start?: boolean
    severity?: SeverityLevel
    reduceMotion?: boolean
    extras?: boolean
    photos?: boolean
    laboratory?: boolean
  } = {}
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().hydrate(
    makeSettings({
      severity: options.severity ?? 'soft',
      reduceMotion: options.reduceMotion ?? false,
      sessionExtras: { enabled: options.extras ?? false },
      photos: { enabled: options.photos ?? false }
    })
  )
  useSessionsStore().beginSession(
    makeExercise({ id: 'neck-circles', durationSec: 30 }),
    'session-1'
  )
  if (options.laboratory) useRuntimeStore().apply({ at: new Date().toISOString(), running: false, silent: false })
  const popup = mount(PopupView, { global: { plugins: [pinia] } })
  if (options.start !== false) await popup.get('[data-testid="start-exercise"]').trigger('click')
  return popup
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  api.sessionResult.mockClear()
  api.closePopup.mockClear()
  api.resizePopup.mockClear()
  api.addPhoto.mockClear()
  api.removePhoto.mockClear()
  api.listPhotos.mockClear()
  soundPlayer.play.mockClear()
  soundPlayer.preload.mockClear()
  Object.defineProperty(window, 'api', { configurable: true, value: api })
  vi.useFakeTimers()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  setLaboratoryClock()
  vi.useRealTimers()
})

describe('PopupView — done flow', () => {
  it('pairs the ready and active captions with the matching portrait', async () => {
    wrapper = await mountPopup({ start: false })
    const readyCaption = wrapper.get('.popup-speech').text()
    expect(useCharacterStore().emotion).toBe('neutral')
    await wrapper.get('[data-testid="start-exercise"]').trigger('click')
    expect(wrapper.get('.popup-speech').text()).not.toBe(readyCaption)
    expect(useCharacterStore().emotion).toBe('focused')
    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()
    expect(wrapper.get('[role="status"] .comic-bubble').attributes('data-tone')).toBe('cheer')
  })

  it('waits for an explicit start instead of consuming the timer on appearance', async () => {
    wrapper = await mountPopup({ severity: 'medium', start: false })
    vi.advanceTimersByTime(60_000)
    await nextTick()
    expect(wrapper.text()).toContain('00:30')
    expect(wrapper.find('[data-testid="start-exercise"]').exists()).toBe(true)
    expect(api.sessionResult).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="start-exercise"]').trigger('click')
    vi.advanceTimersByTime(24_000)
    await nextTick()
    expect(findButton(wrapper, 'Готово').attributes('disabled')).toBeUndefined()
  })

  it('retains the session and offers a retry when saving fails', async () => {
    wrapper = await mountPopup()
    api.sessionResult.mockRejectedValueOnce(new Error('IPC unavailable'))
    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить')
    expect(useSessionsStore().current?.id).toBe('session-1')
    expect(useSessionsStore().history).toHaveLength(0)
    expect(api.closePopup).not.toHaveBeenCalled()
    expect(soundPlayer.play).not.toHaveBeenCalledWith('done')

    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()
    expect(wrapper.get('[role="status"]').text()).toContain('Разминка в зачёт')
    expect(api.sessionResult).toHaveBeenCalledTimes(2)
  })

  it('does not celebrate a rejected acknowledgement', async () => {
    wrapper = await mountPopup()
    api.sessionResult.mockResolvedValueOnce({ saved: false })
    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить')
    expect(useSessionsStore().current?.id).toBe('session-1')
  })

  it('reports the result, plays the exit animation and closes the window', async () => {
    wrapper = await mountPopup()
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

  it('plays the stage-up cue when done unlocks a new stage', async () => {
    wrapper = await mountPopup()
    useSessionsStore().hydrate([
      makeSession({ id: 'prior-1', exerciseId: 'neck-tilts', status: 'done' }),
      makeSession({ id: 'prior-2', exerciseId: 'neck-tilts', status: 'done' })
    ])

    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()

    expect(soundPlayer.play).toHaveBeenCalledWith('stage-up')
  })

  it('plays the plain done cue while the stage is unchanged', async () => {
    wrapper = await mountPopup()

    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()

    expect(soundPlayer.play).toHaveBeenCalledWith('done')
  })

  it('ignores a second click while the first one is in flight', async () => {
    wrapper = await mountPopup()
    const done = findButton(wrapper, 'Готово')

    void done.trigger('click')
    void done.trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledTimes(1)
  })

  it('keeps the saved confirmation readable with reduced motion', async () => {
    wrapper = await mountPopup({ reduceMotion: true })
    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledTimes(1)
    expect(api.closePopup).not.toHaveBeenCalled()
    expect(wrapper.get('[role="status"]').text()).toContain('Разминка в зачёт')
    vi.advanceTimersByTime(POPUP_EXIT_MS.done)
    await flushMicrotasks()
    expect(api.closePopup).toHaveBeenCalledTimes(1)
    expect(wrapper.classes()).not.toContain('popup-out-done')
    expect(wrapper.find('.popup-flash').exists()).toBe(false)
  })
})

describe('PopupView — severity gate', () => {
  it('supports a keyboard hold on hardcore and ignores repeated keydowns', async () => {
    wrapper = await mountPopup({ severity: 'hardcore' })
    vi.advanceTimersByTime(24_000)
    await nextTick()
    const done = findButton(wrapper, 'Готово')
    await done.trigger('keydown', { key: ' ', code: 'Space', repeat: false })
    vi.advanceTimersByTime(1000)
    await done.trigger('keydown', { key: ' ', code: 'Space', repeat: true })
    vi.advanceTimersByTime(500)
    await flushMicrotasks()
    expect(api.sessionResult).toHaveBeenCalledTimes(1)
  })

  it('keeps «Готово» locked on medium until 80% of the timer', async () => {
    wrapper = await mountPopup({ severity: 'medium' })
    const done = findButton(wrapper, 'Готово')
    expect(done.attributes('disabled')).toBeDefined()

    vi.advanceTimersByTime(24_000)
    await nextTick()

    expect(done.attributes('disabled')).toBeUndefined()
  })

  it('unlocks «Готово» immediately on soft', async () => {
    wrapper = await mountPopup({ severity: 'soft' })
    expect(findButton(wrapper, 'Готово').attributes('disabled')).toBeUndefined()
  })
})

describe('PopupView — skip flow', () => {
  it('records a skip, shows the tired face and fades out quietly', async () => {
    wrapper = await mountPopup()
    await findButton(wrapper, 'Пропустить').trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    )
    expect(useCharacterStore().emotion).toBe('neutral')
    expect(wrapper.classes()).toContain('popup-out-quiet')
    expect(wrapper.find('.popup-flash').exists()).toBe(false)

    vi.advanceTimersByTime(POPUP_EXIT_MS.quiet)
    await flushMicrotasks()
    expect(api.closePopup).toHaveBeenCalledTimes(1)
  })
})

describe('PopupView — optional details', () => {
  it('shows no details row while the optional layer is off', async () => {
    wrapper = await mountPopup()
    expect(wrapper.find('[data-testid="extras-toggle"]').exists()).toBe(false)
  })

  it('keeps details collapsed by default and grows the window only when opened', async () => {
    wrapper = await mountPopup({ extras: true })
    const toggle = wrapper.find('[data-testid="extras-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(wrapper.find('[data-testid="extras-panel"]').exists()).toBe(false)

    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="extras-panel"]').exists()).toBe(true)
    expect(api.resizePopup).toHaveBeenLastCalledWith(POPUP_EXTRAS_HEIGHT)

    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="extras-panel"]').exists()).toBe(false)
    expect(api.resizePopup).toHaveBeenLastCalledWith(POPUP_EXTRAS_COLLAPSED_HEIGHT)
  })

  it('submits reps, feeling and weight with the result', async () => {
    wrapper = await mountPopup({ extras: true })

    await wrapper.find('[data-testid="extras-toggle"]').trigger('click')
    await wrapper.find('[data-testid="reps-input"]').setValue('12')
    await wrapper.find('[data-testid="weight-input"]').setValue('72.55')
    await wrapper.find('[data-feeling="4"]').trigger('click')
    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledWith(
      expect.objectContaining({ reps: 12, feeling: 4, weightKg: 72.6 })
    )
  })

  it('drops blank and out-of-range details instead of sending them', async () => {
    wrapper = await mountPopup({ extras: true })

    await wrapper.find('[data-testid="extras-toggle"]').trigger('click')
    await wrapper.find('[data-testid="reps-input"]').setValue('0')
    await wrapper.find('[data-testid="weight-input"]').setValue('5')
    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()

    const payload = api.sessionResult.mock.calls[0]?.[0]
    expect(payload?.reps).toBeUndefined()
    expect(payload?.weightKg).toBeUndefined()
    expect(payload?.feeling).toBeUndefined()
  })

  it('attaches a photo and sends its id with the result', async () => {
    wrapper = await mountPopup({ photos: true })
    await wrapper.get('[data-testid="extras-toggle"]').trigger('click')

    const input = wrapper.get('[data-testid="photo-input"]')
    const file = new File([new Uint8Array([1, 2])], 'photo.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushMicrotasks()

    expect(api.addPhoto).toHaveBeenCalledTimes(1)
    expect(wrapper.find('img[src="photo://photo-1"]').exists()).toBe(true)

    await findButton(wrapper, 'Готово').trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult).toHaveBeenCalledWith(
      expect.objectContaining({ photoIds: ['photo-1'] })
    )
  })

  it('removes an attached photo before submitting', async () => {
    wrapper = await mountPopup({ photos: true })
    await wrapper.get('[data-testid="extras-toggle"]').trigger('click')

    const input = wrapper.get('[data-testid="photo-input"]')
    const file = new File([new Uint8Array([1, 2])], 'photo.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushMicrotasks()

    await wrapper.get('[data-testid="photo-remove"]').trigger('click')
    await flushMicrotasks()

    expect(api.removePhoto).toHaveBeenCalledWith({ id: 'photo-1' })
    expect(wrapper.find('img[src="photo://photo-1"]').exists()).toBe(false)
  })

  it('never attaches details to a skip', async () => {
    wrapper = await mountPopup({ extras: true })

    await wrapper.find('[data-testid="extras-toggle"]').trigger('click')
    await wrapper.find('[data-testid="reps-input"]').setValue('12')
    await findButton(wrapper, 'Пропустить').trigger('click')
    await flushMicrotasks()

    expect(api.sessionResult.mock.calls[0]?.[0]?.reps).toBeUndefined()
  })
})


describe('PopupView — isolated semantic driver', () => {
  let dispatch: (command: LabDriverCommand) => void
  const acknowledge = vi.fn(async () => undefined)
  const unsubscribe = vi.fn()
  beforeEach(() => {
    acknowledge.mockClear(); unsubscribe.mockClear()
    Object.defineProperty(window, 'api', { configurable: true, value: { ...api,
      labDriverAck: acknowledge,
      onLabDriver: (listener: typeof dispatch) => { dispatch = listener; return unsubscribe },
      onLabChanged: () => () => undefined
    } })
  })
  const action = (sequence: number, value: LabDriverCommand['action']) => dispatch({ generation: 9, sessionId: 'session-1', sequence, action: value })
  it('waits for readiness, highlights the real control and rejects done before its severity gate', async () => {
    wrapper = await mountPopup({ start: false, severity: 'medium', laboratory: true })
    await flushMicrotasks()
    expect(acknowledge).toHaveBeenCalledWith({ kind: 'ready', sessionId: 'session-1' })
    action(1, 'highlight-start'); await nextTick()
    expect(wrapper.get('[data-testid="start-exercise"]').attributes('data-lab-highlight')).toBe('true')
    action(2, 'start'); await flushMicrotasks()
    expect(wrapper.find('[data-testid="start-exercise"]').exists()).toBe(false)
    action(3, 'done'); await flushMicrotasks()
    expect(api.sessionResult).not.toHaveBeenCalled()
    expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({ kind: 'failed', sequence: 3 }))
  })
  it('shows an error before any success and retries the same session through the ordinary submit path', async () => {
    wrapper = await mountPopup({ start: false, severity: 'medium', laboratory: true })
    await flushMicrotasks()
    action(1, 'start')
    setLaboratoryClock({ at: new Date(nowMs() + 30000).toISOString(), running: false, silent: false })
    api.sessionResult.mockResolvedValueOnce({ saved: false })
    action(2, 'done'); await flushMicrotasks()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось сохранить')
    expect(wrapper.find('.popup-success').exists()).toBe(false)
    expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({ kind: 'failed', sequence: 2 }))
    action(3, 'done'); await flushMicrotasks()
    expect(api.sessionResult.mock.calls.slice(-2).map(([payload]) => payload.sessionId)).toEqual(['session-1', 'session-1'])
    expect(wrapper.find('.popup-success').exists()).toBe(true)
    dispatch({ generation: 8, sessionId: 'session-1', sequence: 99, action: 'done' })
    await flushMicrotasks()
    expect(api.sessionResult).toHaveBeenCalledTimes(2)
  })
  it('cancels an incomplete real-time Hardcore hold and requires a fresh full hold', async () => {
    wrapper = await mountPopup({ start: false, severity: 'hardcore', laboratory: true })
    await flushMicrotasks()
    action(1, 'start')
    setLaboratoryClock({ at: new Date(nowMs() + 30000).toISOString(), running: false, silent: false })
    vi.advanceTimersByTime(250); await nextTick()
    action(2, 'hold')
    vi.advanceTimersByTime(750)
    action(3, 'cancel')
    vi.advanceTimersByTime(3000); await flushMicrotasks()
    expect(api.sessionResult).not.toHaveBeenCalled()
    action(4, 'hold')
    vi.advanceTimersByTime(1499); await flushMicrotasks()
    expect(api.sessionResult).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); await flushMicrotasks()
    expect(api.sessionResult).toHaveBeenCalledOnce()
  })
  it('does not subscribe to the driver outside the isolated runtime', async () => {
    const spy = vi.fn()
    Object.defineProperty(window, 'api', { configurable: true, value: { ...api, onLabDriver: spy } })
    wrapper = await mountPopup({ start: false })
    await flushMicrotasks()
    expect(spy).not.toHaveBeenCalled()
  })
})
