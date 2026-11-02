<script setup lang="ts">
import { computed } from 'vue'
import { ZONES, ZONE_LABELS } from '@shared/constants/catalog-axes'
import type { Zone } from '@shared/types/exercise-v2'

const props = defineProps<{
  zones: Partial<Record<Zone, number>>
  compact?: boolean
}>()

const segments = computed(() =>
  ZONES.map((zone) => ({
    zone,
    share: props.zones[zone] ?? 0,
    label: ZONE_LABELS[zone]
  })).filter((item) => item.share > 0)
)

const dominant = computed(() => {
  let best: Zone | null = null
  let max = -1
  for (const item of segments.value) {
    if (item.share > max) {
      max = item.share
      best = item.zone
    }
  }
  return best
})

const COLORS: Record<Zone, string> = {
  upper: 'bg-sky-500',
  core: 'bg-amber-500',
  lower: 'bg-violet-500',
  full: 'bg-emerald-500'
}
</script>

<template>
  <div class="w-full" :title="segments.map((s) => `${s.label} ${Math.round(s.share * 100)}%`).join(' · ')">
    <div class="flex h-2 overflow-hidden rounded bg-slate-800" :class="compact ? 'h-1.5 w-16' : 'h-2'">
      <div
        v-for="seg in segments"
        :key="seg.zone"
        :class="[COLORS[seg.zone], seg.zone === dominant ? 'opacity-100' : 'opacity-70']"
        :style="{ width: `${seg.share * 100}%` }"
      />
    </div>
    <div v-if="!compact" class="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
      <span v-for="seg in segments" :key="seg.zone" :class="seg.zone === dominant ? 'text-slate-200' : ''">
        {{ seg.label }} {{ Math.round(seg.share * 100) }}%
      </span>
    </div>
  </div>
</template>
