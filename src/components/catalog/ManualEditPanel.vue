<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { METHOD_LABELS, METHODS, ZONE_LABELS, ZONES } from '@shared/constants/catalog-axes'
import { dose, intensityCap } from '@shared/domain/dose'
import { poolSnapshot } from '@shared/domain/catalog-sandbox'
import { coverageMatrix } from '@shared/domain/coverage'
import type { ExerciseV2, Intensity, Method, Zone } from '@shared/types/exercise-v2'
import { useCatalogStore } from '@/stores/catalog'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import FieldHelp from '@/components/catalog/FieldHelp.vue'

const catalog = useCatalogStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()

const exercise = computed(() =>
  catalog.editExerciseId
    ? catalog.resolved.find((ex) => ex.id === catalog.editExerciseId)
    : undefined
)

const draft = reactive({
  intensity: 1 as Intensity,
  method: 'mobility' as Method,
  minSec: 20,
  defaultSec: 40,
  maxSec: 60,
  zones: { upper: 0, core: 0, lower: 0, full: 0 } as Record<Zone, number>
})

watch(
  exercise,
  (ex) => {
    if (!ex) return
    draft.intensity = ex.intensity
    draft.method = ex.method
    draft.minSec = ex.timer.minSec
    draft.defaultSec = ex.timer.defaultSec
    draft.maxSec = ex.timer.maxSec
    for (const z of ZONES) draft.zones[z] = ex.zones[z] ?? 0
  },
  { immediate: true }
)

const zoneSum = computed(() => ZONES.reduce((s, z) => s + (draft.zones[z] ?? 0), 0))
const issues = computed(() => {
  const list: string[] = []
  if (Math.abs(zoneSum.value - 1) > 0.05) list.push('сумма зон должна быть ≈ 1.0')
  if (draft.minSec > draft.defaultSec || draft.defaultSec > draft.maxSec)
    list.push('таймер: min ≤ default ≤ max')
  if (draft.intensity < 1 || draft.intensity > 5) list.push('интенсивность 1–5')
  return list
})

const consequences = computed(() => {
  if (!exercise.value) return null
  const patched = {
    ...exercise.value,
    intensity: draft.intensity,
    method: draft.method,
    timer: { minSec: draft.minSec, defaultSec: draft.defaultSec, maxSec: draft.maxSec },
    zones: { ...draft.zones }
  }
  const catalogList = catalog.resolved.map((ex) => (ex.id === patched.id ? patched : ex))
  const cell = coverageMatrix(catalogList).find(
    (c) => c.zone === patched.dominantZone && c.method === patched.method
  )
  const snap = poolSnapshot(
    {
      catalog: catalogList,
      recentSessions: sessions.history,
      settings: settings.asSettings(),
      focus: settings.focusV2,
      profileStrength: settings.profileStrength,
      useShareProfile: true
    },
    1
  )
  const cand = snap.candidates.find((c) => c.id === patched.id)
  return {
    doseNow: dose(patched.timer, settings.intervalMinutes),
    cap: intensityCap(settings.intervalMinutes),
    probability: cand?.probability ?? 0,
    filteredBy: cand?.filteredBy,
    cellCount: cell?.count ?? 0,
    dominant: patched.dominantZone
  }
})

async function save(): Promise<void> {
  if (!exercise.value || issues.value.length) return
  const patch: Partial<ExerciseV2> = {
    intensity: draft.intensity,
    method: draft.method,
    timer: { minSec: draft.minSec, defaultSec: draft.defaultSec, maxSec: draft.maxSec },
    zones: { ...draft.zones }
  }
  await window.api?.applyCatalogManualEdit?.({
    id: exercise.value.id,
    patch,
    reason: 'ручное изменение из каталога'
  })
  await catalog.refresh()
  catalog.clearManualEdit()
}
</script>

<template>
  <section v-if="exercise" class="settings-card space-y-4" data-testid="manual-edit-panel">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-white">Изменить · {{ exercise.title }}</h2>
      <button type="button" class="setting-chip text-[11px]" @click="catalog.clearManualEdit()">Отмена</button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 text-xs">
      <label>
        Интенсивность <FieldHelp field-key="intensity" />
        <input v-model.number="draft.intensity" type="range" min="1" max="5" class="w-full accent-emerald-500" />
        {{ draft.intensity }}
      </label>
      <label>
        Метод <FieldHelp field-key="method" />
        <select v-model="draft.method" class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1">
          <option v-for="m in METHODS" :key="m" :value="m">{{ METHOD_LABELS[m] }}</option>
        </select>
      </label>
      <div>
        Таймер (min / default / max)
        <div class="mt-1 flex gap-2">
          <input v-model.number="draft.minSec" type="number" class="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
          <input v-model.number="draft.defaultSec" type="number" class="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
          <input v-model.number="draft.maxSec" type="number" class="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
        </div>
      </div>
    </div>

    <div>
      <p class="text-xs text-slate-400">Зоны (сумма {{ zoneSum.toFixed(2) }}) <FieldHelp field-key="zones" /></p>
      <div class="mt-2 grid gap-2 sm:grid-cols-2">
        <label v-for="z in ZONES" :key="z" class="text-xs text-slate-300">
          {{ ZONE_LABELS[z] }}
          <input v-model.number="draft.zones[z]" type="range" min="0" max="1" step="0.05" class="w-full accent-emerald-500" />
          {{ draft.zones[z].toFixed(2) }}
        </label>
      </div>
    </div>

    <div class="rounded border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
      <p class="font-semibold text-slate-200">Последствия</p>
      <ul v-if="consequences" class="mt-2 space-y-1 text-slate-400">
        <li>доза сейчас: {{ consequences.doseNow }} с</li>
        <li>шанс: {{ (consequences.probability * 100).toFixed(1) }}% <template v-if="consequences.filteredBy">(фильтр {{ consequences.filteredBy }})</template></li>
        <li>ячейка покрытия (доминанта {{ consequences.dominant }}): {{ consequences.cellCount }}</li>
        <li>потолок интенсивности: {{ consequences.cap }}</li>
      </ul>
      <ul v-if="issues.length" class="mt-2 space-y-1 text-amber-300">
        <li v-for="issue in issues" :key="issue">⚠ {{ issue }}</li>
      </ul>
    </div>

    <button
      type="button"
      class="setting-chip"
      :disabled="issues.length > 0"
      @click="save"
    >
      Сохранить (changeset edit)
    </button>
  </section>
</template>
