import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Exercise } from '@shared/types/exercise'

/** Approved AI exercises; main owns the file, this is a renderer projection. */
export const useCustomExercisesStore = defineStore('customExercises', () => {
  const entries = ref<Exercise[]>([])

  function hydrate(exercises: Exercise[]): void {
    entries.value = exercises.map((exercise) => ({
      ...exercise,
      ...(exercise.equipment ? { equipment: [...exercise.equipment] } : {}),
      ...(exercise.focus ? { focus: [...exercise.focus] } : {})
    }))
  }

  async function refresh(): Promise<void> {
    const exercises = await window.api?.listCustomExercises?.()
    if (exercises) hydrate(exercises)
  }

  /** Approval is an explicit user action; returns null when main rejected it. */
  async function approve(exercise: Exercise): Promise<Exercise | null> {
    const result = await window.api?.addCustomExercise?.({ exercise })
    if (result?.exercises) hydrate(result.exercises)
    return result?.exercise ?? null
  }

  async function remove(id: string): Promise<void> {
    const result = await window.api?.removeCustomExercise?.({ id })
    if (result?.exercises) hydrate(result.exercises)
  }

  return {
    entries,
    hydrate,
    refresh,
    approve,
    remove
  }
})
