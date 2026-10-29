import type { DataSnapshot } from '@shared/types/persistence'
import { useSettingsStore } from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'
import { useWeightStore } from '@/stores/weight'
import { useReminderStore } from '@/stores/reminder'
import { usePhotosStore } from '@/stores/photos'
import { useCustomExercisesStore } from '@/stores/custom-exercises'

export function applySnapshot(snapshot: DataSnapshot): void {
  useSettingsStore().hydrate(snapshot.settings)
  useProgressStore().hydrate(snapshot.progress)
  useSessionsStore().hydrate(snapshot.sessions)
  useWeightStore().hydrate(snapshot.weights)
}

/** Load main-owned state into Pinia and subscribe to loop / data updates. */
export async function hydrateFromMain(): Promise<() => void> {
  const api = window.api
  if (!api?.getSnapshot) {
    return () => undefined
  }

  applySnapshot(await api.getSnapshot())

  const reminder = useReminderStore()
  reminder.apply(await api.getLoopState())

  const photos = usePhotosStore()
  await photos.refresh()

  const customExercises = useCustomExercisesStore()
  await customExercises.refresh()

  const unsubscribers = [
    api.onDataUpdated((next) => applySnapshot(next)),
    api.onLoopStateChanged((next) => reminder.apply(next)),
    api.onPhotosUpdated?.((next) => photos.hydrate(next.photos)) ?? (() => undefined),
    api.onExercisesUpdated?.((next) => customExercises.hydrate(next.exercises)) ??
      (() => undefined)
  ]

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}
