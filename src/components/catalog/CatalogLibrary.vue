<script setup lang="ts">
import { computed } from 'vue'
import { METHOD_LABELS, ZONE_LABELS } from '@shared/constants/catalog-axes'
import { explainPick } from '@shared/domain/picker'
import type { ExerciseV2Resolved } from '@shared/types/exercise-v2'
import FilterRail from '@/components/catalog/FilterRail.vue'
import ExerciseRow from '@/components/catalog/ExerciseRow.vue'
import ExerciseDrawer from '@/components/catalog/ExerciseDrawer.vue'
import HowItWorks from '@/components/catalog/HowItWorks.vue'
import QueueStrip from '@/components/catalog/QueueStrip.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useCatalogViewStore } from '@/stores/catalog-view'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { useQueueStore } from '@/stores/queue'

const catalog = useCatalogStore()
const view = useCatalogViewStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()
const queue = useQueueStore()

const pickInput = computed(() => ({
  catalog: catalog.resolved,
  recentSessions: sessions.history,
  settings: settings.asSettings(),
  focus: settings.focusV2,
  profileStrength: settings.profileStrength,
  overrides: settings.overrides,
  limitations: settings.limitations,
  useShareProfile: true as const
}))

const explanation = computed(() => explainPick(pickInput.value, 1))

const candidateById = computed(() => {
  const map = new Map(explanation.value.candidates.map((c) => [c.id, c]))
  return map
})

const hintMap = computed(() => {
  const map = new Map<string, string[]>()
  for (const hint of catalog.hints) {
    const list = map.get(hint.exerciseId) ?? []
    list.push(hint.kind)
    map.set(hint.exerciseId, list)
  }
  return map
})

const filtered = computed(() => {
  const f = view.filters
  const inventory = settings.asSettings().inventory
  let list = [...catalog.resolved]

  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase()
    list = list.filter(
      (ex) => ex.title.toLowerCase().includes(q) || ex.description.toLowerCase().includes(q)
    )
  }
  if (f.zones.length) list = list.filter((ex) => f.zones.some((z) => (ex.zones[z] ?? 0) > 0))
  if (f.methods.length) list = list.filter((ex) => f.methods.includes(ex.method))
  list = list.filter((ex) => ex.intensity >= f.intensityMin && ex.intensity <= f.intensityMax)
  list = list.filter((ex) => ex.timer.defaultSec >= f.timerMin && ex.timer.defaultSec <= f.timerMax)
  if (f.status !== 'all') list = list.filter((ex) => ex.status === f.status)
  if (f.source !== 'all') list = list.filter((ex) => ex.source.kind === f.source)
  if (f.batchId) list = list.filter((ex) => ex.source.batchId === f.batchId)
  if (f.hintsOnly) list = list.filter((ex) => (hintMap.value.get(ex.id)?.length ?? 0) > 0)
  if (f.equipmentIds.length) {
    list = list.filter((ex) => (ex.equipment ?? []).some((id) => f.equipmentIds.includes(id)))
  }
  if (f.equipmentMode === 'have') {
    list = list.filter((ex) => {
      const need = ex.equipment ?? []
      return need.length === 0 || (inventory.enabled && need.every((id) => inventory.items.includes(id)))
    })
  }
  if (f.equipmentMode === 'missing') {
    list = list.filter((ex) => {
      const need = ex.equipment ?? []
      return need.length > 0 && (!inventory.enabled || need.some((id) => !inventory.items.includes(id)))
    })
  }
  if (f.availableNow) {
    list = list.filter((ex) => !candidateById.value.get(ex.id)?.filteredBy)
  }

  const skipStats = (id: string) => {
    const rows = sessions.history.filter((s) => s.exerciseId === id)
    if (rows.length === 0) return 0
    return rows.filter((s) => s.status === 'skipped' || s.status === 'missed').length / rows.length
  }
  const lastShown = (id: string) => {
    const row = sessions.history.find((s) => s.exerciseId === id)
    return row ? Date.parse(row.completedAt ?? row.triggeredAt) : 0
  }

  list.sort((a, b) => {
    switch (view.sort) {
      case 'intensity':
        return b.intensity - a.intensity
      case 'timer':
        return b.timer.defaultSec - a.timer.defaultSec
      case 'probability':
        return (candidateById.value.get(b.id)?.probability ?? 0) - (candidateById.value.get(a.id)?.probability ?? 0)
      case 'lastShown':
        return lastShown(b.id) - lastShown(a.id)
      case 'skipRate':
        return skipStats(b.id) - skipStats(a.id)
      default:
        return a.title.localeCompare(b.title, 'ru')
    }
  })
  return list
})

const groups = computed(() => {
  if (view.groupBy === 'none') return [{ key: 'all', label: '', items: filtered.value }]
  const map = new Map<string, ExerciseV2Resolved[]>()
  for (const ex of filtered.value) {
    let key = ''
    let label = ''
    if (view.groupBy === 'zone') {
      key = ex.dominantZone
      label = ZONE_LABELS[ex.dominantZone]
    } else if (view.groupBy === 'method') {
      key = ex.method
      label = METHOD_LABELS[ex.method]
    } else {
      key = ex.source.batchId ?? ex.source.kind
      label = catalog.batches.find((b) => b.id === key)?.name ?? key
    }
    const list = map.get(key) ?? []
    list.push(ex)
    map.set(key, list)
  }
  return Array.from(map.entries()).map(([key, items]) => {
    let label = key
    if (view.groupBy === 'zone') label = ZONE_LABELS[key as keyof typeof ZONE_LABELS] ?? key
    else if (view.groupBy === 'method') label = METHOD_LABELS[key as keyof typeof METHOD_LABELS] ?? key
    else label = catalog.batches.find((b) => b.id === key)?.name ?? key
    return { key, label, items }
  })
})

const selected = computed(() =>
  view.selectedId ? catalog.resolved.find((ex) => ex.id === view.selectedId) : undefined
)

async function onArchive(): Promise<void> {
  if (!selected.value) return
  await window.api?.setCatalogStatus?.({ id: selected.value.id, status: 'archived' })
  await catalog.refresh()
  view.closeDrawer()
}

async function onPin(): Promise<void> {
  if (!selected.value) return
  await queue.pinExercise(selected.value.id, 0)
}

async function onExcludeToday(): Promise<void> {
  if (!selected.value) return
  await queue.excludeToday(selected.value.id)
}
</script>

<template>
  <section class="space-y-3" data-testid="catalog-library">
    <QueueStrip />

    <div v-if="view.showHowItWorks" class="space-y-2">
      <button type="button" class="setting-chip text-[11px]" @click="view.showHowItWorks = false">← К каталогу</button>
      <HowItWorks />
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(280px,360px)]">
      <FilterRail />

      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <label class="text-slate-500">
            Сортировка
            <select v-model="view.sort" class="ml-1 rounded border border-slate-700 bg-slate-950 px-2 py-1">
              <option value="title">название</option>
              <option value="intensity">интенсивность</option>
              <option value="timer">таймер</option>
              <option value="probability">шанс сейчас</option>
              <option value="lastShown">последний показ</option>
              <option value="skipRate">пропуски</option>
            </select>
          </label>
          <label class="text-slate-500">
            Группы
            <select v-model="view.groupBy" class="ml-1 rounded border border-slate-700 bg-slate-950 px-2 py-1">
              <option value="none">нет</option>
              <option value="zone">зона</option>
              <option value="method">метод</option>
              <option value="set">набор</option>
            </select>
          </label>
          <button type="button" class="setting-chip text-[11px]" @click="view.showHowItWorks = true">
            Как это работает
          </button>
          <span class="text-slate-500">{{ filtered.length }} упр.</span>
        </div>

        <div class="space-y-4">
          <div v-for="group in groups" :key="group.key" class="space-y-2">
            <h3 v-if="group.label" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {{ group.label }}
            </h3>
            <ExerciseRow
              v-for="exercise in group.items"
              :key="exercise.id"
              :exercise="exercise"
              :candidate="candidateById.get(exercise.id)"
              :batch-name="catalog.batches.find((b) => b.id === exercise.source.batchId)?.name"
              :hints="hintMap.get(exercise.id)"
              :selected="view.selectedId === exercise.id"
              @select="view.selectExercise(exercise.id)"
            />
          </div>
        </div>
      </div>

      <div v-if="view.drawerOpen && selected" class="min-h-[420px]">
        <ExerciseDrawer
          :exercise="selected"
          :pick-input="pickInput"
          @close="view.closeDrawer()"
          @edit="catalog.openManualEdit(selected.id)"
          @archive="onArchive"
          @pin="onPin"
          @exclude-today="onExcludeToday"
          @how-it-works="view.showHowItWorks = true"
        />
      </div>
    </div>
  </section>
</template>
