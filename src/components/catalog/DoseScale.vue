<script setup lang="ts">
import { computed } from 'vue'
import { dose, intensityCap } from '@shared/domain/dose'
import type { ExerciseTimer, Intensity } from '@shared/types/exercise-v2'
import FieldHelp from '@/components/catalog/FieldHelp.vue'

const props = defineProps<{
  timer: ExerciseTimer
  intensity: Intensity
  intervalMinutes: number
  scale?: number
}>()

const current = computed(() => dose(props.timer, props.intervalMinutes, props.scale ?? 1))
const at15 = computed(() => dose(props.timer, 15, props.scale ?? 1))
const at45 = computed(() => dose(props.timer, 45, props.scale ?? 1))
const at90 = computed(() => dose(props.timer, 90, props.scale ?? 1))
const cap = computed(() => intensityCap(props.intervalMinutes))
const blocked = computed(() => props.intensity > cap.value)

const markerPct = computed(() => {
  const span = Math.max(1, props.timer.maxSec - props.timer.minSec)
  return Math.min(100, Math.max(0, ((current.value - props.timer.minSec) / span) * 100))
})
</script>

<template>
  <div class="space-y-2 text-xs text-slate-300">
    <div class="flex items-center gap-1 font-medium text-slate-200">
      Доза сейчас
      <FieldHelp field-key="timer.defaultSec" />
    </div>
    <div class="relative h-2 rounded-full bg-slate-800">
      <div
        class="absolute inset-y-0 left-0 rounded-full bg-emerald-500/70"
        :style="{ width: `${markerPct}%` }"
      />
      <div
        class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-400"
        :style="{ left: `${markerPct}%` }"
        :title="`${current} с`"
      />
    </div>
    <p class="text-slate-400">
      min {{ timer.minSec }} · default {{ timer.defaultSec }} · max {{ timer.maxSec }} с
      → сейчас <span class="text-white">{{ current }} с</span>
    </p>
    <p class="text-slate-500">
      при интервале 45 мин: {{ at45 }} с; при 15 мин: {{ at15 }} с; при 90 мин: {{ at90 }} с
    </p>
    <p :class="blocked ? 'text-amber-300' : 'text-slate-500'">
      интенсивность {{ intensity }}, потолок при {{ intervalMinutes }} мин = {{ cap }}
      <template v-if="blocked"> → в таком режиме не выпадет</template>
    </p>
  </div>
</template>
