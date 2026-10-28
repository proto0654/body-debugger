import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, SessionStatus } from '@shared/types/session'
import type { Exercise } from '@shared/types/exercise'
import { pickNextExercise } from '@/domain/exercise-picker'
import { useProgressStore } from './progress'
import { useSettingsStore } from './settings'

export const useSessionsStore = defineStore('sessions', () => {
  const history = ref<Session[]>([])
  const current = ref<Session | null>(null)
  const currentExercise = ref<Exercise | null>(null)

  const lastSession = computed(() => history.value[history.value.length - 1] ?? null)

  function beginSession(exercise?: Exercise): Session {
    const progress = useProgressStore()
    const settings = useSettingsStore()
    const picked =
      exercise ??
      pickNextExercise({
        catalog: [],
        recentSessions: history.value,
        progress: progress.asUserProgress(),
        settings: settings.asSettings()
      })

    const session: Session = {
      id: crypto.randomUUID(),
      exerciseId: picked.id,
      status: 'missed',
      durationSec: picked.durationSec,
      triggeredAt: new Date().toISOString()
    }

    current.value = session
    currentExercise.value = picked
    return session
  }

  /** Stub: records result into history; stage/streak updates come later */
  function recordResult(
    status: SessionStatus,
    extras?: Partial<Pick<Session, 'durationSec' | 'skipReason' | 'reps' | 'feeling'>>
  ): Session | null {
    if (!current.value) return null

    const session: Session = {
      ...current.value,
      ...extras,
      status,
      completedAt: new Date().toISOString()
    }

    history.value = [...history.value, session]
    current.value = null
    return session
  }

  function clearCurrent(): void {
    current.value = null
    currentExercise.value = null
  }

  return {
    history,
    current,
    currentExercise,
    lastSession,
    beginSession,
    recordResult,
    clearCurrent
  }
})
