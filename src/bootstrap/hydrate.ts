import type { DataSnapshot } from '@shared/types/persistence'
import { useSettingsStore } from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'

export function applySnapshot(snapshot: DataSnapshot): void {
  useSettingsStore().hydrate(snapshot.settings)
  useProgressStore().hydrate(snapshot.progress)
  useSessionsStore().hydrate(snapshot.sessions)
}

/** Load main-owned state into Pinia; subscribe to cross-window updates. */
export async function hydrateFromMain(): Promise<() => void> {
  if (!window.api?.getSnapshot) {
    return () => undefined
  }

  const snapshot = await window.api.getSnapshot()
  applySnapshot(snapshot)

  if (!window.api.onDataUpdated) {
    return () => undefined
  }

  return window.api.onDataUpdated((next) => {
    applySnapshot(next)
  })
}
