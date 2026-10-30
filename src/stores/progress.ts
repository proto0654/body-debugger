import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExerciseLevels, Streak, UserFocus, UserProgress } from '@shared/types/progress'
import type { CharacterBranch, CharacterBuild, CharacterStage } from '@shared/types/character'
import { CHARACTER_BUILDS } from '@shared/constants/character'

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

  function hydrate(next: UserProgress): void {
    streak.value = { ...next.streak }
    characterStage.value = next.characterStage
    characterBranch.value = next.characterBranch
    characterBuild.value = next.characterBuild
    exerciseLevels.value = { ...next.exerciseLevels }
    focus.value = {
      primary: next.focus.primary,
      accents: [...next.focus.accents]
    }
  }

  async function persist(): Promise<void> {
    if (!window.api?.saveProgress) return
    const snapshot = await window.api.saveProgress(asUserProgress())
    hydrate(snapshot.progress)
  }

  /** Build is a user preference (CONCEPT.md §5); unknown values are ignored. */
  async function setCharacterBuild(next: CharacterBuild): Promise<void> {
    if (!CHARACTER_BUILDS.includes(next) || characterBuild.value === next) return
    characterBuild.value = next
    await persist()
  }

  return {
    streak,
    characterStage,
    characterBranch,
    characterBuild,
    exerciseLevels,
    focus,
    asUserProgress,
    hydrate,
    persist,
    setCharacterBuild
  }
})
