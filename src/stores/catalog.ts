import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { coverageMatrix, type CoverageCell } from '@shared/domain/coverage'
import {
  cooldownExerciseIds,
  exerciseHints,
  type ExerciseHint
} from '@shared/domain/tune'
import {
  resolveCatalog,
  shippedBatch,
  shippedCatalogV2
} from '@shared/domain/catalog'
import type { CatalogBatch, ExerciseV2, Method, Zone } from '@shared/types/exercise-v2'
import type { PickExplanation } from '@shared/domain/picker'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'
import { resolveExercise } from '@shared/domain/exercise-v2'
import { exerciseUnavailableReason } from '@shared/domain/exercise-start'
import { useDashboardNavigation } from './dashboard-navigation'

export type ExercisesSection = 'library' | 'sandbox' | 'coverage' | 'sets' | 'ai'

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
  const section = ref<ExercisesSection>('library')
  const selectedCell = ref<SelectedCoverageCell | null>(null)
  const editExerciseId = ref<string | null>(null)

  const resolved = computed(() => {
    const settings = useSettingsStore()
    return resolveCatalog(
      shippedCatalogV2(),
      userExercises.value,
      settings.overrides,
      batches.value
    )
  })
  const library = computed(() => {
    const effective = new Map(resolved.value.map(exercise => [exercise.id, exercise]))
    return [...shippedCatalogV2(), ...userExercises.value].map(exercise => effective.get(exercise.id) ?? resolveExercise(exercise))
  })
  function unavailableReason(id: string): string | null {
    const exercise = resolved.value.find(entry => entry.id === id)
    if (!exercise) return 'Упражнение в архиве, отключено или заменено своим вариантом.'
    return exerciseUnavailableReason(exercise, useSettingsStore().asSettings())
  }

  const coverage = computed((): CoverageCell[] => coverageMatrix(resolved.value))

  const hints = computed((): ExerciseHint[] => {
    const settings = useSettingsStore()
    const sessions = useSessionsStore()
    const scales: Record<string, number> = {}
    for (const [id, override] of Object.entries(settings.overrides)) {
      if (override.scale !== undefined) scales[id] = override.scale
    }
    const cooling = cooldownExerciseIds(sessions.history, settings.overrides)
    return exerciseHints(sessions.history, resolved.value, scales, cooling)
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
    useDashboardNavigation().navigate('exercises', 'ai', { task: 'generate' })
  }

  function clearSelectedCell(): void {
    selectedCell.value = null
  }

  function setLastExplanation(explanation: PickExplanation | null): void {
    lastExplanation.value = explanation
  }

  function openManualEdit(id: string): void {
    editExerciseId.value = id
    section.value = 'sandbox'
    useDashboardNavigation().navigate('exercises', 'edit', { exerciseId: id })
  }

  function clearManualEdit(): void {
    editExerciseId.value = null
  }

  return {
    userExercises,
    batches,
    lastExplanation,
    section,
    selectedCell,
    editExerciseId,
    resolved,
    library,
    unavailableReason,
    coverage,
    hints,
    refresh,
    applyCatalogFile,
    openAiForCell,
    clearSelectedCell,
    setLastExplanation,
    openManualEdit,
    clearManualEdit
  }
})
