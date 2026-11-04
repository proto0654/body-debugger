import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCharacterAppearanceStore } from '@/stores/character-appearance'
import { useSettingsStore } from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { defaultProgress } from '../../electron/main/persistence/defaults'
import { makeSettings } from '../fixtures'

beforeEach(() => {
  setActivePinia(createPinia())
  useSettingsStore().hydrate(makeSettings())
  useProgressStore().hydrate(defaultProgress())
})

describe('character fitting room', () => {
  it('keeps a draft across component lifetimes and discards it without persistence', () => {
    const settings = useSettingsStore()
    const save = vi.spyOn(settings, 'setCharacterPack')
    const draft = useCharacterAppearanceStore()
    draft.packId = 'engineer'
    draft.build = 'stocky'
    expect(useCharacterAppearanceStore().packId).toBe('engineer')
    expect(settings.characterPackId).toBe('desk-hulk')
    expect(save).not.toHaveBeenCalled()
    draft.cancel()
    expect(draft.dirty).toBe(false)
    expect(draft.build).toBe('average')
  })
  it('retains the unsaved build when identity succeeds but the build write fails', async () => {
    const settings = useSettingsStore()
    const progress = useProgressStore()
    vi.spyOn(settings, 'setCharacterPack').mockImplementation(async id => { settings.characterPackId = id })
    const saveBuild = vi.spyOn(progress, 'setCharacterBuild').mockRejectedValueOnce(new Error('disk full'))
    const draft = useCharacterAppearanceStore()
    draft.packId = 'engineer'
    draft.build = 'stocky'
    await draft.apply()
    expect(settings.characterPackId).toBe('engineer')
    expect(progress.characterBuild).toBe('average')
    expect(draft.build).toBe('stocky')
    expect(draft.dirty).toBe(true)
    expect(draft.error).toContain('Не всё')
    saveBuild.mockImplementation(async build => { progress.characterBuild = build })
    await draft.apply()
    expect(draft.dirty).toBe(false)
    expect(draft.error).toBe('')
  })
})
