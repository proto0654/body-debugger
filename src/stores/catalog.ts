import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { coverageMatrix, type CoverageCell } from '@shared/domain/coverage'
import { exerciseHints, type ExerciseHint } from '@shared/domain/tune'
import {
  resolveCatalog,
  shippedBatch,
  shippedCatalogV2
} from '@shared/domain/catalog'
import type { CatalogBatch, ExerciseV2, Method, Zone } from '@shared/types/exercise-v2'
import type { PickExplanation } from '@shared/domain/picker'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'

export type ExercisesSection = 'coverage' | 'pick' | 'sets' | 'ai'

export interface SelectedCoverageCell {
  zone: Zone
  method: Method
}

type CatalogFilePayload = {
  version: 2
  exercises: ExerciseV2[]
  batches: CatalogBatch[]
}

export const useCatalogStore = defineStore('catalog', () => {
  const userExercises = ref<ExerciseV2[]>([])
  const batches = ref<CatalogBatch[]>([shippedBatch()])
  const lastExplanation = ref<PickExplanation | null>(null)
  const section = ref<ExercisesSection>('coverage')
  const selectedCell = ref<SelectedCoverageCell | null>(null)

  const resolved = computed(() => {
    const settings = useSettingsStore()
    return resolveCatalog(
      shippedCatalogV2(),
      userExercises.value,
      settings.overrides,
      batches.value
    )
  })

  const coverage = computed((): CoverageCell[] => coverageMatrix(resolved.value))

  const hints = computed((): ExerciseHint[] => {
    const settings = useSettingsStore()
    const sessions = useSessionsStore()
    const scales: Record<string, number> = {}
    for (const [id, override] of Object.entries(settings.overrides)) {
      if (override.scale !== undefined) scales[id] = override.scale
    }
    return exerciseHints(sessions.history, resolved.value, scales)
  })

  function mergeBatches(fromFile: CatalogBatch[]): void {
    const shipped = shippedBatch()
    shipped.count = shippedCatalogV2().length
    const rest = fromFile.filter((batch) => batch.id !== shipped.id)
    batches.value = [shipped, ...rest]
  }

  async function refresh(): Promise<void> {
    try {
      const listed = await window.api?.listCatalog?.()
      if (listed?.catalog) {
        userExercises.value = [...listed.catalog.exercises]
        mergeBatches(listed.catalog.batches)
        return
      }
    } catch (cause) {
      console.warn('[catalog] listCatalog unavailable', cause)
    }
    userExercises.value = []
    mergeBatches([])
  }

  function applyCatalogFile(file: CatalogFilePayload): void {
    userExercises.value = [...file.exercises]
    mergeBatches(file.batches)
  }

  function openAiForCell(cell: SelectedCoverageCell): void {
    selectedCell.value = cell
    section.value = 'ai'
  }

  function setLastExplanation(explanation: PickExplanation | null): void {
    lastExplanation.value = explanation
  }

  return {
    userExercises,
    batches,
    lastExplanation,
    section,
    selectedCell,
    resolved,
    coverage,
    hints,
    refresh,
    applyCatalogFile,
    openAiForCell,
    setLastExplanation
  }
})
