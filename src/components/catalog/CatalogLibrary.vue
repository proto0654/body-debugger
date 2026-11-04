<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { METHOD_LABELS, ZONE_LABELS, ZONES } from '@shared/constants/catalog-axes'
import { explainPick } from '@shared/domain/picker'
import type { ExerciseV2Resolved } from '@shared/types/exercise-v2'
import FilterRail from '@/components/catalog/FilterRail.vue'
import ExerciseRow from '@/components/catalog/ExerciseRow.vue'
import ExerciseDrawer from '@/components/catalog/ExerciseDrawer.vue'
import HowItWorks from '@/components/catalog/HowItWorks.vue'
import { useDashboardNavigation } from '@/stores/dashboard-navigation'
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
const navigation = useDashboardNavigation()
const listElement = ref<HTMLElement | null>(null)
const message = ref('')
const error = ref('')
watch(() => navigation.location.exerciseId, id => view.selectExercise(id ?? null), { immediate: true })
watch(() => view.filters.status, status => { if (status === 'archived') view.filters.availableNow = false })
onMounted(async () => { await nextTick(); if (listElement.value) listElement.value.scrollTop = view.scrollTop })
onBeforeUnmount(() => { if (listElement.value) view.scrollTop = listElement.value.scrollTop })

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
  let list = [...catalog.library]

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
    list = list.filter((ex) => !catalog.unavailableReason(ex.id))
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
  view.selectedId ? catalog.library.find((ex) => ex.id === view.selectedId) : undefined
)

async function perform(action: () => Promise<void>): Promise<void> {
  error.value = ''
  try { await action() }
  catch (cause) { console.warn('[catalog-library] action failed', cause); error.value = 'Не удалось сохранить изменение. Попробуйте ещё раз.' }
}
async function onArchive(): Promise<void> {
  const exercise = selected.value
  if (!exercise) return
  await perform(async () => { const result = await window.api.setCatalogStatus({ id: exercise.id, status: 'archived' }); if (!result.ok) throw new Error('Archive rejected'); await catalog.refresh(); navigation.navigate('exercises', 'library') })
}
async function onPin(): Promise<void> {
  if (!selected.value) return
  await perform(async () => { await queue.pinExercise(selected.value!.id, 0); message.value = 'Закреплено на следующий перерыв.' })
}
async function onExcludeToday(): Promise<void> {
  if (!selected.value) return
  await perform(async () => { await queue.excludeToday(selected.value!.id); message.value = 'Упражнение исключено из подбора до конца дня.' })
}
</script>

<template>
  <section class="space-y-4" data-testid="catalog-library">
    <p v-if="message" role="status" class="text-sm text-emerald-400">{{ message }}</p>
    <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>
    <p v-if="navigation.location.exerciseId && !selected" role="status" class="text-sm text-amber-300">Упражнение больше не найдено в каталоге. Выберите другое.</p>
    <div v-if="view.showHowItWorks" class="space-y-3"><button type="button" class="setting-chip" @click="view.showHowItWorks = false">← К каталогу</button><HowItWorks /></div>
    <template v-else>
      <div class="flex flex-wrap items-center gap-2"><button v-for="zone in ZONES" :key="zone" type="button" class="setting-chip" :aria-pressed="view.filters.zones.includes(zone)" @click="view.filters.zones = view.filters.zones.includes(zone) ? view.filters.zones.filter(item => item !== zone) : [...view.filters.zones, zone]">{{ ZONE_LABELS[zone] }}</button><label class="ml-auto flex items-center gap-2 text-sm"><input v-model="view.filters.availableNow" type="checkbox">Только доступные</label></div>
      <details class="settings-card catalog-filters"><summary>Поиск и фильтры · {{ filtered.length }} упражнений</summary><FilterRail /></details>
      <div class="catalog-browser" :class="{ 'catalog-browser--selected': selected }">
        <div class="catalog-browser-list space-y-3">
          <label class="block text-sm text-slate-300">Найти упражнение<input v-model="view.filters.query" type="search" placeholder="Название или описание" class="profile-select mt-2 w-full"></label>
          <div class="flex flex-wrap gap-2 text-sm"><label>Порядок <select v-model="view.sort" class="profile-select"><option value="title">По названию</option><option value="timer">По длительности</option><option value="lastShown">Недавние</option></select></label><span class="text-slate-400">{{ filtered.length }} упражнений</span></div>
          <div ref="listElement" class="catalog-scroll space-y-2" @scroll="view.scrollTop = ($event.target as HTMLElement).scrollTop">
            <template v-for="group in groups" :key="group.key"><h3 v-if="group.label" class="text-sm text-slate-400">{{ group.label }}</h3><ExerciseRow v-for="exercise in group.items" :key="exercise.id" :exercise="exercise" :candidate="candidateById.get(exercise.id)" :selected="selected?.id === exercise.id" @select="navigation.navigate('exercises', 'library', { exerciseId: exercise.id })" /></template>
            <p v-if="!filtered.length" class="py-8 text-sm text-slate-400">Нет подходящих упражнений. Измените поиск или раскройте фильтры. Ограничения профиля сохраняются.</p>
          </div>
        </div>
        <ExerciseDrawer v-if="selected" :exercise="selected" :pick-input="pickInput" @close="navigation.navigate('exercises', 'library')" @edit="catalog.openManualEdit(selected.id)" @archive="onArchive" @pin="onPin" @exclude-today="onExcludeToday" @how-it-works="view.showHowItWorks = true" />
        <div v-else class="catalog-empty-preview settings-card"><h2 class="text-lg font-semibold">Как выполнять упражнение</h2><p class="mt-3 text-sm text-slate-400">Выберите упражнение: здесь появятся инструкция, длительность и запуск разминки.</p></div>
      </div>
    </template>
  </section>
</template>
