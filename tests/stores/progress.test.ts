import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProgressStore } from '@/stores/progress'
import type { DataSnapshot } from '@shared/types/persistence'
import type { UserProgress } from '@shared/types/progress'
import { makeSettings } from '../fixtures'

function progress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    streak: { current: 2, max: 4 },
    characterStage: 1,
    characterBranch: 'neutral',
    characterBuild: 'average',
    exerciseLevels: { 'neck-circles': 2 },
    focus: { primary: 'mobility', accents: ['balance'] },
    ...overrides
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('progress store', () => {
  it('hydrates snapshots without sharing references', () => {
    const store = useProgressStore()
    const source = progress()
    store.hydrate(source)

    source.streak.current = 99
    source.exerciseLevels['neck-circles'] = 9
    source.focus.accents.push('strength')

    expect(store.streak.current).toBe(2)
    expect(store.exerciseLevels['neck-circles']).toBe(2)
    expect(store.focus.accents).toEqual(['balance'])
  })

  it('exports the hydrated state as UserProgress', () => {
    const store = useProgressStore()
    store.hydrate(progress({ characterStage: 4, characterBranch: 'power' }))
    expect(store.asUserProgress()).toMatchObject({
      characterStage: 4,
      characterBranch: 'power',
      streak: { current: 2, max: 4 }
    })
  })

  it('keeps hydrated streak totals intact', () => {
    const store = useProgressStore()
    store.hydrate(progress({ streak: { current: 7, max: 9 } }))
    expect(store.streak).toEqual({ current: 7, max: 9 })
  })

  it('persists a build change and ignores unknown or repeated values', async () => {
    const saveProgress = vi.fn(
      async (next: UserProgress): Promise<DataSnapshot> => ({
        settings: makeSettings(),
        progress: next,
        sessions: [],
        weights: []
      })
    )
    Object.defineProperty(window, 'api', { configurable: true, value: { saveProgress } })

    const store = useProgressStore()
    store.hydrate(progress())

    await store.setCharacterBuild('stocky')
    expect(store.characterBuild).toBe('stocky')
    expect(saveProgress.mock.calls[0][0]).toMatchObject({ characterBuild: 'stocky' })

    await store.setCharacterBuild('huge' as never)
    await store.setCharacterBuild('stocky')
    expect(store.characterBuild).toBe('stocky')
    expect(saveProgress).toHaveBeenCalledTimes(1)
  })
})
