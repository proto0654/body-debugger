import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { hydrateFromMain } from '@/bootstrap/hydrate'
import { useSettingsStore } from '@/stores/settings'
import { makeSettings } from '../fixtures'

beforeEach(() => { setActivePinia(createPinia()) })

describe('core hydration', () => {
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
      getLoopState: async () => ({ paused: false, intervalMinutes: 30, nextTriggerAt: null }),
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
