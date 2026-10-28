import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  CharacterBranch,
  CharacterBuild,
  CharacterEmotion,
  CharacterStage,
  CharacterState,
  CharacterVisualKey
} from '@shared/types/character'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'
import { useProgressStore } from './progress'
import { useSettingsStore } from './settings'

function buildCandidates(
  packId: string,
  stage: CharacterStage,
  branch: CharacterBranch,
  build: CharacterBuild
): string[] {
  return [
    `${packId}/stage-${stage}-${branch}-${build}`,
    `${packId}/stage-${stage}-${branch}`,
    `${packId}/stage-${stage}`,
    `${packId}/emoji`
  ]
}

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
      candidates: buildCandidates(s.packId, s.stage, s.branch, s.build)
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
