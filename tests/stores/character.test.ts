import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { characterBodyCandidates } from '@shared/domain/character-visual'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'
import type { UserProgress } from '@shared/types/progress'
import { makeSettings } from '../fixtures'

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
