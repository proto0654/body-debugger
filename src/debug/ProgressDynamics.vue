<script setup lang="ts">
import { computed } from 'vue'
import { labDynamics } from '@shared/domain/laboratory-playback'
import { STAGE_THRESHOLDS } from '@shared/domain/character-progress'
import { buildHeatmap } from '@shared/domain/stats'
import type { Session } from '@shared/types/session'

const props = defineProps<{ sessions: Session[]; now: Date; startAt?: string }>()
const dynamics = computed(() => labDynamics(props.sessions, props.now))
const end = computed(() => props.now.getTime())
const start = computed(() => Math.min(Date.parse(props.startAt ?? '') || end.value, dynamics.value.points[0]?.at ?? end.value))
const nextThreshold = computed(() => STAGE_THRESHOLDS.find(value => value.done > dynamics.value.done)?.done ?? Math.max(80, dynamics.value.done))
const days = computed(() => buildHeatmap(props.sessions.filter(session => Date.parse(session.completedAt ?? session.triggeredAt) <= end.value), { days: 14, now: props.now }).days)
function x(at: number): number { return 28 + 640 * (at - start.value) / Math.max(1, end.value - start.value) }
function y(value: number, max: number): number { return 88 - 70 * value / max }
function line(key: 'done' | 'condition', max: number): string {
  const points = dynamics.value.points
  let path = 'M 28 88'
  for (const point of points) path += ` H ${x(point.at)} V ${y(point[key], max)}`
  return `${path} H 668`
}
</script>

<template>
  <section class="space-y-2" aria-label="Динамика прогресса" data-testid="lab-dynamics">
    <div class="grid gap-2 sm:grid-cols-2">
      <figure class="rounded-xl bg-slate-950 p-2">
        <figcaption class="text-[11px] text-emerald-300">Выполнения · {{ dynamics.done }} · пороги форм</figcaption>
        <svg viewBox="0 0 700 110" role="img" :aria-label="`Накоплено выполнений: ${dynamics.done}`" class="w-full">
          <g v-for="threshold in STAGE_THRESHOLDS.filter(value => value.done <= nextThreshold)" :key="threshold.stage">
            <line x1="28" x2="668" :y1="y(threshold.done, nextThreshold)" :y2="y(threshold.done, nextThreshold)" stroke="currentColor" stroke-dasharray="4 5" class="text-slate-700" />
            <text x="0" :y="y(threshold.done, nextThreshold) + 4" fill="currentColor" font-size="12" class="text-slate-500">{{ threshold.done }}</text>
          </g>
          <path :d="line('done', nextThreshold)" fill="none" stroke="currentColor" stroke-width="3" class="text-emerald-400" />
          <line x1="668" x2="668" y1="8" y2="94" stroke="currentColor" class="text-amber-300" />
          <circle v-for="(marker, index) in dynamics.markers" :key="index" :cx="x(marker.at)" cy="99" r="3" fill="currentColor" class="text-amber-300"><title>{{ marker.label }}</title></circle>
        </svg>
      </figure>
      <figure class="rounded-xl bg-slate-950 p-2">
        <figcaption class="text-[11px] text-amber-300">Временное ухудшение · {{ dynamics.condition }} / 10</figcaption>
        <svg viewBox="0 0 700 110" role="img" :aria-label="`Ухудшение: ${dynamics.condition} из 10`" class="w-full">
          <g v-for="level in [0, 3, 6, 10]" :key="level"><line x1="28" x2="668" :y1="y(level, 10)" :y2="y(level, 10)" stroke="currentColor" stroke-dasharray="4 5" class="text-slate-700" /><text x="0" :y="y(level, 10) + 4" fill="currentColor" font-size="12" class="text-slate-500">{{ level }}</text></g>
          <path :d="line('condition', 10)" fill="none" stroke="currentColor" stroke-width="3" class="text-amber-400" />
          <line x1="668" x2="668" y1="8" y2="94" stroke="currentColor" class="text-amber-300" />
        </svg>
      </figure>
    </div>
    <p v-if="!dynamics.points.length" class="text-[11px] text-slate-500">История пока пуста. Графики обновятся после сохранения результата.</p>
    <div class="flex items-center gap-1" aria-label="Активность за 14 дней"><span v-for="day in days" :key="day.date" class="h-3 min-w-0 flex-1 rounded-sm" :class="day.done ? 'bg-emerald-500' : day.missed + day.skipped ? 'bg-amber-800' : 'bg-slate-800'" :title="`${day.date}: выполнено ${day.done}, пропусков ${day.skipped + day.missed}`" /></div>
    <p class="text-[10px] text-slate-500">{{ new Date(start).toLocaleDateString('ru-RU') }} → {{ now.toLocaleString('ru-RU') }} · янтарная линия — текущее время</p>
    <p v-if="dynamics.markers.length" class="text-[10px] text-slate-400">{{ dynamics.markers.slice(-3).map(marker => marker.label).join(' · ') }}</p>
  </section>
</template>
