<script setup lang="ts">
import { METHOD_LABELS, ZONE_LABELS } from '@shared/constants/catalog-axes'
import type { ExerciseV2Resolved } from '@shared/types/exercise-v2'
import type { FilterReason, PickCandidate } from '@shared/domain/picker'
import ZoneBar from '@/components/catalog/ZoneBar.vue'

defineProps<{
  exercise: ExerciseV2Resolved
  candidate?: PickCandidate
  batchName?: string
  hints?: string[]
  selected?: boolean
}>()

defineEmits<{ select: [] }>()

const FILTER_LABELS: Record<FilterReason, string> = {
  inventory: 'нет инвентаря',
  intensityCap: 'потолок интенсивности',
  avoidIf: 'ограничение',
  context: 'контекст',
  archived: 'в архиве'
}

function dots(n: number): string {
  return '●'.repeat(n) + '○'.repeat(Math.max(0, 5 - n))
}
</script>

<template>
  <button
    type="button"
    class="flex w-full items-start gap-3 rounded border px-3 py-2 text-left transition"
    :class="
      selected
        ? 'border-emerald-500/60 bg-emerald-500/10'
        : candidate?.filteredBy
          ? 'border-slate-800 bg-slate-950/40 opacity-70'
          : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
    "
    @click="$emit('select')"
  >
    <span class="text-lg" aria-hidden="true">{{ exercise.emojiFallback }}</span>
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <p class="truncate text-sm font-medium text-white">{{ exercise.title }}</p>
        <ZoneBar :zones="exercise.zones" compact class="mt-1 shrink-0" />
      </div>
      <p class="mt-0.5 text-[11px] text-slate-400">
        {{ METHOD_LABELS[exercise.method] }} · {{ dots(exercise.intensity) }} ·
        {{ exercise.timer.minSec }}–{{ exercise.timer.defaultSec }}–{{ exercise.timer.maxSec }} с ·
        {{ ZONE_LABELS[exercise.dominantZone] }}
      </p>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
        <span v-if="candidate?.filteredBy" class="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
          {{ FILTER_LABELS[candidate.filteredBy] }}
        </span>
        <span v-else-if="candidate" class="text-emerald-400/90">
          шанс сейчас {{ (candidate.probability * 100).toFixed(1) }}%
        </span>
        <span v-if="batchName" class="rounded bg-slate-800 px-1.5 py-0.5 text-slate-500">{{ batchName }}</span>
        <span
          v-for="hint in hints ?? []"
          :key="hint"
          class="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300"
        >
          {{ hint }}
        </span>
      </div>
    </div>
  </button>
</template>
