import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  CharacterEmotion,
  CharacterState,
  CharacterVisualKey
} from '@shared/types/character'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'
import { characterBodyCandidates } from '@shared/domain/character-visual'
import { characterConditionLabel, computeCharacterCondition } from '@shared/domain/character-condition'
import { characterReaction, type CharacterReactionEvent } from '@shared/domain/character-reaction'
import { useProgressStore } from './progress'
import { useSettingsStore } from './settings'
import { useSessionsStore } from './sessions'

export const useCharacterStore = defineStore('character', () => {
  const condition = computed(() => computeCharacterCondition(useSessionsStore().history))
  const conditionLabel = computed(() => characterConditionLabel(condition.value.level, state.value.build))
  const reaction = ref(characterReaction('welcome'))
  const emotion = computed(() => reaction.value.emotion)
  const reactionCounts: Partial<Record<CharacterReactionEvent, number>> = {}
  let reactionId = 0

  function react(event: CharacterReactionEvent, sequence?: number): void {
    const nextSequence = sequence ?? reactionCounts[event] ?? 0
    reaction.value = characterReaction(event, nextSequence, reaction.value.caption)
    reaction.value.animationId = `reaction-${++reactionId}`
    reactionCounts[event] = (Number.isSafeInteger(nextSequence) ? nextSequence : 0) + 1
  }

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
      candidates: characterBodyCandidates(s.stage, s.branch, s.build, condition.value.level, s.packId)
    }
  })

  function setEmotion(next: CharacterEmotion): void {
    reaction.value = { ...reaction.value, emotion: next }
  }

  return {
    emotion,
    reaction,
    react,
    state,
    visualKey,
    condition,
    conditionLabel,
    setEmotion
  }
})
