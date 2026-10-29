import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProgressStore } from '@/stores/progress'
import type { UserProgress } from '@shared/types/progress'

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

  it('bumps the current streak and keep the max in sync', () => {
    const store = useProgressStore()
    store.hydrate(progress({ streak: { current: 4, max: 4 } }))
    store.bumpStreak()
    expect(store.streak).toEqual({ current: 5, max: 5 })
  })

  it('does not lower the max streak when the current one resets', () => {
    const store = useProgressStore()
    store.hydrate(progress({ streak: { current: 7, max: 9 } }))
    store.resetStreak()
    expect(store.streak).toEqual({ current: 0, max: 9 })
  })
})
