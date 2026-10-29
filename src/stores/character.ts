import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  CharacterEmotion,
  CharacterState,
  CharacterVisualKey
} from '@shared/types/character'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'
import { characterBodyCandidates } from '@shared/domain/character-visual'
import { useProgressStore } from './progress'
import { useSettingsStore } from './settings'

export const useCharacterStore = defineStore('character', () => {
  const emotion = ref<CharacterEmotion>('neutral')

  const state = computed<CharacterState>(() => {
    const progress = useProgressStore()
    const settings = useSettingsStore()
    return {
      stage: progress.characterStage,
      branch: progress.characterBranch,
      build: progress.characterBuild,
      emotion: emotion.value,
      packId: settings.characterPackId || DEFAULT_CHARACTER_PACK
    }
  })

  const visualKey = computed<CharacterVisualKey>(() => {
    const s = state.value
    return {
      packId: s.packId,
      stage: s.stage,
      branch: s.branch,
      build: s.build,
      emotion: s.emotion,
      candidates: characterBodyCandidates(s.stage, s.branch, s.build)
    }
  })

  function setEmotion(next: CharacterEmotion): void {
    emotion.value = next
  }

  return {
    emotion,
    state,
    visualKey,
    setEmotion
  }
})
