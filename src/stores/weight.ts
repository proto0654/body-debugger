import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  WEIGHT_HISTORY_DAYS,
  latestWeightEntry,
  normalizeWeightEntry,
  weightSeries,
  type WeightPoint
} from '@shared/domain/weight'
import type { WeightEntry } from '@shared/types/weight'

/** Renderer mirror of the main-owned weight history (optional layer). */
export const useWeightStore = defineStore('weight', () => {
  const entries = ref<WeightEntry[]>([])

  const latest = computed(() => latestWeightEntry(entries.value))

  function hydrate(next: WeightEntry[]): void {
    entries.value = next.map((entry) => ({ ...entry }))
  }

  function series(now: Date = new Date(), days = WEIGHT_HISTORY_DAYS): WeightPoint[] {
    return weightSeries(entries.value, { now, days })
  }

  /** Newest first, capped for the dashboard list. */
  function recent(limit = 5): WeightEntry[] {
    return [...entries.value]
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, limit)
  }

  /**
   * Stores a manual measurement. Returns false for out-of-range values or when
   * the preload bridge is absent, so the form can keep the input untouched.
   */
  async function add(weightKg: number, at?: string): Promise<boolean> {
    if (!normalizeWeightEntry({ weightKg, at })) return false
    if (!window.api?.addWeight) return false

    const snapshot = await window.api.addWeight({ weightKg, at })
    hydrate(snapshot.weights)
    return true
  }

  async function remove(id: string): Promise<void> {
    if (!window.api?.removeWeight) return

    const snapshot = await window.api.removeWeight({ id })
    hydrate(snapshot.weights)
  }

  return { entries, latest, hydrate, series, recent, add, remove }
})
