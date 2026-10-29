import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, SessionStatus } from '@shared/types/session'
import type { Exercise } from '@shared/types/exercise'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { pickNextExercise } from '@shared/domain/exercise-picker'
import { useSettingsStore } from './settings'

export const useSessionsStore = defineStore('sessions', () => {
  const history = ref<Session[]>([])
  const current = ref<Session | null>(null)
  const currentExercise = ref<Exercise | null>(null)

  const lastSession = computed(() => history.value[history.value.length - 1] ?? null)

  function hydrate(sessions: Session[]): void {
    history.value = sessions.map((s) => ({ ...s }))
  }

  function beginSession(exercise?: Exercise, sessionId?: string): Session {
    const settings = useSettingsStore()
    const picked =
      exercise ??
      pickNextExercise({
        catalog: EXERCISE_CATALOG,
        recentSessions: history.value,
        settings: settings.asSettings()
      })

    const session: Session = {
      id: sessionId ?? crypto.randomUUID(),
      exerciseId: picked.id,
      status: 'missed',
      durationSec: picked.durationSec,
      triggeredAt: new Date().toISOString()
    }

    current.value = session
    currentExercise.value = picked
    return session
  }

  /**
   * Records result into local current→history for UI feedback.
   * Canonical append + streak live in main (session:result → persistence).
   */
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
    hydrate,
    beginSession,
    recordResult,
    clearCurrent
  }
})
