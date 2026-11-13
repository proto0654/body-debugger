import type { DataSnapshot } from '@shared/types/persistence'
import { useRuntimeStore } from '@/stores/runtime'
import { useSettingsStore } from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'
import { useWeightStore } from '@/stores/weight'
import { useReminderStore } from '@/stores/reminder'
import { usePhotosStore } from '@/stores/photos'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { rendererApi } from '@/renderer-api'
import { getActivePinia, type Pinia } from 'pinia'

export function applySnapshot(snapshot: DataSnapshot, pinia?: Pinia): void {
  useRuntimeStore(pinia).apply(snapshot.laboratory)
  useSettingsStore(pinia).hydrate(snapshot.settings)
  useProgressStore(pinia).hydrate(snapshot.progress)
  useSessionsStore(pinia).hydrate(snapshot.sessions)
  useWeightStore(pinia).hydrate(snapshot.weights)
}

/** Load main-owned state into Pinia and subscribe to loop / data updates. */
export async function hydrateFromMain(): Promise<() => void> {
  const api = rendererApi()
  const pinia = getActivePinia()
  if (!api?.getSnapshot) {
    return () => undefined
  }

  applySnapshot(await api.getSnapshot(), pinia)

  const reminder = useReminderStore(pinia)
  reminder.apply(await api.getLoopState())

  const photos = usePhotosStore(pinia)
  const customExercises = useCustomExercisesStore(pinia)

  const unsubscribers = [
    api.onDataUpdated((next) => applySnapshot(next, pinia)),
    api.onLoopStateChanged((next) => reminder.apply(next)),
    api.onPhotosUpdated?.((next) => photos.hydrate(next.photos)) ?? (() => undefined),
    api.onExercisesUpdated?.((next) => customExercises.hydrate(next.exercises)) ??
      (() => undefined)
  ]

  // These layers may fail or remain pending without delaying the core renderer.
  const optionalLoads = [['photos', photos.refresh()], ['exercises', customExercises.refresh()]] as const
  for (const [layer, request] of optionalLoads) {
    void request.catch((cause) => console.warn(`[hydrate] optional ${layer} unavailable`, cause))
  }

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}
