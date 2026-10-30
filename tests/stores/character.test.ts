import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'
import { characterBodyCandidates } from '@shared/domain/character-visual'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'
import type { UserProgress } from '@shared/types/progress'
import { makeSession, makeSettings } from '../fixtures'

beforeEach(() => {
  setActivePinia(createPinia())
})

function hydrateProgress(overrides: Partial<UserProgress> = {}): void {
  useProgressStore().hydrate({
    streak: { current: 0, max: 0 },
    characterStage: 0,
    characterBranch: 'neutral',
    characterBuild: 'average',
    exerciseLevels: {},
    focus: { primary: null, accents: [] },
    ...overrides
  })
}

describe('character store', () => {
  it('rebuilds condition from history while retaining the earned stage, branch and chosen build', () => {
    hydrateProgress({ characterStage: 5, characterBranch: 'power', characterBuild: 'stocky' })
    const sessions = useSessionsStore()
    const history = Array.from({ length: 10 }, () => makeSession({ exerciseId: 'neck-tilts', status: 'skipped' }))
    sessions.hydrate(history)
    const store = useCharacterStore()
    const before = useProgressStore().asUserProgress()
    expect(store.condition).toEqual({ points: 10, level: 3, recoverySessions: 5 })
    expect(store.conditionLabel).toBe('Скуф')
    expect(store.visualKey.candidates[0]).toBe('neglect-3-stocky')
    sessions.hydrate([...history, ...Array.from({ length: 5 }, () => makeSession({ exerciseId: 'neck-tilts' }))])
    expect(store.condition.points).toBe(0)
    expect(store.visualKey.candidates[0]).toBe('pose-power-stocky')
    expect(useProgressStore().asUserProgress()).toEqual(before)
    sessions.hydrate(history)
    expect(store.condition.level).toBe(3)
    useProgressStore().characterBuild = 'lean'
    expect(store.conditionLabel).toBe('Дрыщ')
    expect(store.visualKey.candidates[0]).toBe('neglect-3-lean')
    useProgressStore().characterBuild = 'neutral'
    expect(store.conditionLabel).toBe('Сутулый')
    expect(store.visualKey.candidates[0]).toBe('neglect-3-average')
  })

  it('changes captions and emotions without changing durable progress', () => {
    hydrateProgress({ characterStage: 2 })
    const store = useCharacterStore()
    const before = useProgressStore().asUserProgress()
    store.react('done')
    const firstCaption = store.reaction.caption
    store.react('done')
    expect(store.reaction.caption).not.toBe(firstCaption)
    expect(store.emotion).toBe('happy')
    expect(useProgressStore().asUserProgress()).toEqual(before)
    store.react('skipped')
    expect(store.emotion).toBe('neutral')
    expect(store.reaction.tone).toBe('calm')
  })

  it('derives the state from progress and settings', () => {
    hydrateProgress({ characterStage: 3, characterBranch: 'power', characterBuild: 'stocky' })
    useSettingsStore().hydrate(makeSettings({ characterPackId: 'custom-pack' }))
    const store = useCharacterStore()

    expect(store.state).toEqual({
      stage: 3,
      branch: 'power',
      build: 'stocky',
      emotion: 'neutral',
      packId: 'custom-pack'
    })
  })

  it('falls back to the default pack when settings carry none', () => {
    hydrateProgress()
    useSettingsStore().hydrate(makeSettings({ characterPackId: '' }))
    expect(useCharacterStore().state.packId).toBe(DEFAULT_CHARACTER_PACK)
  })

  it('exposes the same candidates as the shared frame rules', () => {
    hydrateProgress({ characterStage: 4, characterBranch: 'mobility', characterBuild: 'lean' })
    useSettingsStore().hydrate(makeSettings())
    const store = useCharacterStore()

    expect(store.visualKey.candidates).toEqual(characterBodyCandidates(4, 'mobility', 'lean'))
    expect(store.visualKey.packId).toBe(DEFAULT_CHARACTER_PACK)
  })

  it('updates the emotion without touching progress', () => {
    hydrateProgress({ characterStage: 2 })
    const store = useCharacterStore()
    store.setEmotion('happy')

    expect(store.emotion).toBe('happy')
    expect(store.state.emotion).toBe('happy')
    expect(store.reaction.emotion).toBe('happy')
    expect(useProgressStore().characterStage).toBe(2)
  })
})
