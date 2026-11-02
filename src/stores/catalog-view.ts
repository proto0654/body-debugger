import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Method, Zone } from '@shared/types/exercise-v2'

export type CatalogSort =
  | 'title'
  | 'intensity'
  | 'timer'
  | 'probability'
  | 'lastShown'
  | 'skipRate'

export type CatalogGroupBy = 'none' | 'zone' | 'method' | 'set'

export interface CatalogViewFilters {
  query: string
  zones: Zone[]
  methods: Method[]
  intensityMin: number
  intensityMax: number
  timerMin: number
  timerMax: number
  equipmentMode: 'any' | 'have' | 'missing'
  equipmentIds: string[]
  batchId: string | null
  status: 'all' | 'active' | 'archived'
  source: 'all' | 'shipped' | 'user' | 'llm'
  hintsOnly: boolean
  availableNow: boolean
}

const defaultFilters = (): CatalogViewFilters => ({
  query: '',
  zones: [],
  methods: [],
  intensityMin: 1,
  intensityMax: 5,
  timerMin: 0,
  timerMax: 300,
  equipmentMode: 'any',
  equipmentIds: [],
  batchId: null,
  status: 'all',
  source: 'all',
  hintsOnly: false,
  availableNow: false
})

export const useCatalogViewStore = defineStore('catalogView', () => {
  const filters = ref(defaultFilters())
  const sort = ref<CatalogSort>('title')
  const groupBy = ref<CatalogGroupBy>('none')
  const selectedId = ref<string | null>(null)
  const drawerOpen = ref(false)
  const showHowItWorks = ref(false)

  function selectExercise(id: string | null): void {
    selectedId.value = id
    drawerOpen.value = id !== null
  }

  function closeDrawer(): void {
    drawerOpen.value = false
    selectedId.value = null
  }

  function resetFilters(): void {
    filters.value = defaultFilters()
  }

  return {
    filters,
    sort,
    groupBy,
    selectedId,
    drawerOpen,
    showHowItWorks,
    selectExercise,
    closeDrawer,
    resetFilters
  }
})
