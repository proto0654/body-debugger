import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExerciseRecommendation, StartExerciseRequest } from '@shared/domain/exercise-start'
import { useCatalogStore } from './catalog'

export const useExerciseStartStore = defineStore('exerciseStart', () => {
  const recommendation = ref<ExerciseRecommendation | null>(null)
  const busy = ref(false)
  const error = ref('')
  let loadSequence = 0
  async function refresh(): Promise<void> {
    const sequence = ++loadSequence
    try {
      const next = await window.api?.previewNextExercise?.()
      if (sequence === loadSequence) {
        recommendation.value = next ?? null
        if (next === null) error.value = 'Нет доступных упражнений. Проверьте ограничения и инвентарь в подборе под себя.'
      }
    } catch (cause) {
      if (sequence !== loadSequence) return
      recommendation.value = null
      error.value = 'Не удалось загрузить рекомендацию. Попробуйте ещё раз.'
      console.warn('[exercise-start] recommendation failed', cause)
    }
  }
  async function start(request: StartExerciseRequest): Promise<void> {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      const result = await window.api?.startExercise?.(request)
      if (!result) throw new Error('Exercise start bridge unavailable')
      if ('message' in result) error.value = result.message
      if (result.status === 'stale' || result.status === 'started') await refresh()
      if (result.status === 'unavailable') await useCatalogStore().refresh()
    } catch (cause) {
      console.warn('[exercise-start] start failed', cause)
      error.value = 'Не удалось открыть разминку. Попробуйте ещё раз.'
    } finally { busy.value = false }
  }
  return { recommendation, busy, error, refresh, start }
})
