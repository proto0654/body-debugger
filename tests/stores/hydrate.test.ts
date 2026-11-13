import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { hydrateFromMain } from '@/bootstrap/hydrate'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'
import type { DataSnapshot } from '@shared/types/persistence'
import { defaultProgress } from '../../electron/main/persistence/defaults'
import { makeSession, makeSettings } from '../fixtures'

beforeEach(() => { setActivePinia(createPinia()) })

describe('core hydration', () => {
  it('applies main updates to the main profile while the laboratory is active', async () => {
    const mainPinia = createPinia()
    setActivePinia(mainPinia)
    const initial: DataSnapshot = { settings: makeSettings(), progress: defaultProgress(), sessions: [], weights: [] }
    let listener: (snapshot: DataSnapshot) => void = () => undefined
    Object.defineProperty(window, 'api', { configurable: true, value: {
      getSnapshot: async () => initial,
      getLoopState: async () => ({ paused: false, intervalMinutes: 30, nextTriggerAt: null, countdownAnchorAt: null, heldProgress: null }),
      listPhotos: async () => [], listCustomExercises: async () => [],
      onDataUpdated: (handler: typeof listener) => { listener = handler; return () => undefined },
      onLoopStateChanged: () => () => undefined
    } })
    const dispose = await hydrateFromMain()
    const labPinia = createPinia()
    setActivePinia(labPinia)
    listener({ ...initial, sessions: [makeSession({ id: 'main-session', exerciseId: 'neck-tilts' })] })
    expect(useSessionsStore(mainPinia).history.map(session => session.id)).toEqual(['main-session'])
    expect(useSessionsStore(labPinia).history).toHaveLength(0)
    dispose()
  })
  it('starts and subscribes even while optional layers are failed or pending', async () => {
    const unsubscribe = vi.fn()
    const onDataUpdated = vi.fn(() => unsubscribe)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    Object.defineProperty(window, 'api', { configurable: true, value: {
      getSnapshot: async () => ({
        settings: makeSettings({ intervalMinutes: 30 }), sessions: [], weights: [],
        progress: { streak: { current: 0, max: 0 }, characterStage: 0, characterBranch: 'neutral',
          characterBuild: 'average', exerciseLevels: {}, focus: { primary: null, accents: [] } }
      }),
      getLoopState: async () => ({
        paused: false, intervalMinutes: 30, nextTriggerAt: null, countdownAnchorAt: null, heldProgress: null
      }),
      listPhotos: async () => { throw new Error('optional photos unavailable') },
      listCustomExercises: () => new Promise(() => undefined),
      onDataUpdated, onLoopStateChanged: () => unsubscribe
    } })

    const dispose = await hydrateFromMain()
    expect(useSettingsStore().intervalMinutes).toBe(30)
    expect(onDataUpdated).toHaveBeenCalledTimes(1)
    dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })
})
