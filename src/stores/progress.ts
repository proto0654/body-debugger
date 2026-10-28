import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExerciseLevels, Streak, UserFocus, UserProgress } from '@shared/types/progress'
import type { CharacterBranch, CharacterBuild, CharacterStage } from '@shared/types/character'

export const useProgressStore = defineStore('progress', () => {
  const streak = ref<Streak>({ current: 0, max: 0 })
  const characterStage = ref<CharacterStage>(0)
  const characterBranch = ref<CharacterBranch>('neutral')
  const characterBuild = ref<CharacterBuild>('average')
  const exerciseLevels = ref<ExerciseLevels>({})
  const focus = ref<UserFocus>({ primary: null, accents: [] })

  function asUserProgress(): UserProgress {
    return {
      streak: { ...streak.value },
      characterStage: characterStage.value,
      characterBranch: characterBranch.value,
      characterBuild: characterBuild.value,
      exerciseLevels: { ...exerciseLevels.value },
      focus: {
        primary: focus.value.primary,
        accents: [...focus.value.accents]
      }
    }
  }

  /** Stub — real bump uses domain/character-progress later */
  function bumpStreak(): void {
    streak.value = {
      current: streak.value.current + 1,
      max: Math.max(streak.value.max, streak.value.current + 1)
    }
  }

  function resetStreak(): void {
    streak.value = { ...streak.value, current: 0 }
  }

  return {
    streak,
    characterStage,
    characterBranch,
    characterBuild,
    exerciseLevels,
    focus,
    asUserProgress,
    bumpStreak,
    resetStreak
  }
})
