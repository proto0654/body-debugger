<script setup lang="ts">
import { nowDate } from '@shared/domain/clock'
import { computed } from 'vue'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { buildHeatmap, summarizeStats, type DayActivity } from '@shared/domain/stats'
import type { Exercise } from '@shared/types/exercise'
import type { Session } from '@shared/types/session'

const props = withDefaults(
  defineProps<{
    sessions: Session[]
    now?: Date
    catalog?: readonly Exercise[]
  }>(),
  {
    now: () => nowDate(),
    catalog: () => EXERCISE_CATALOG
  }
)

const summary = computed(() =>
  summarizeStats(props.sessions, { now: props.now, catalog: props.catalog })
)

const week = computed(() => buildHeatmap(props.sessions, { days: 7, now: props.now }).days)
const weekMax = computed(() => Math.max(1, ...week.value.map((day) => day.done)))

const weekdayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function weekday(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? '' : weekdayLabels[parsed.getDay()]
}

function barHeight(day: DayActivity): string {
  if (day.done === 0) return '0%'
  return `${Math.max(8, Math.round((day.done / weekMax.value) * 100))}%`
}

const groupLabels: Record<string, string> = {
  upper: 'Верх',
  lower: 'Низ',
  full: 'Корпус',
  equipment: 'Инвентарь'
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

function average(value: number): string {
  return value.toFixed(1)
}
</script>

<template>
  <div class="space-y-4" data-testid="stats-panel">
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div class="rounded-xl bg-slate-900 p-3" data-testid="stat-done">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">Выполнено</p>
        <p class="text-xl font-semibold text-white">{{ summary.done }}</p>
      </div>
      <div class="rounded-xl bg-slate-900 p-3" data-testid="stat-active-days">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">Активных дней</p>
        <p class="text-xl font-semibold text-white">{{ summary.activeDays }}</p>
      </div>
      <div class="rounded-xl bg-slate-900 p-3" data-testid="stat-week">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">За 7 дней</p>
        <p class="text-xl font-semibold text-white">{{ summary.weekDone }}</p>
      </div>
      <div class="rounded-xl bg-slate-900 p-3" data-testid="stat-skipped">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">Пропущено</p>
        <p class="text-xl font-semibold text-white">{{ summary.skipped }}</p>
      </div>
    </div>

    <section class="space-y-1 rounded-xl bg-slate-900 p-3" data-testid="week-chart">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Активность за 7 дней
        </h2>
        <span class="text-[10px] text-slate-500">{{ summary.weekDone }} выполнено</span>
      </div>
      <div class="flex h-16 items-end gap-1">
        <div
          v-for="day in week"
          :key="day.date"
          class="flex h-full flex-1 flex-col justify-end"
          :title="`${day.date}: ${day.done}`"
        >
          <div
            :data-week-bar="day.date"
            :data-done="day.done"
            class="w-full rounded-t bg-emerald-500/80"
            :style="{ height: barHeight(day) }"
          />
        </div>
      </div>
      <div class="flex gap-1">
        <span
          v-for="day in week"
          :key="`label-${day.date}`"
          class="flex-1 text-center text-[9px] text-slate-600"
        >
          {{ weekday(day.date) }}
        </span>
      </div>
    </section>

    <p v-if="summary.done === 0" class="text-sm text-slate-500">
      Пока нет выполненных сессий — статистика появится после первой.
    </p>

    <template v-else>
      <p class="text-xs text-slate-500">
        В среднем {{ average(summary.averagePerActiveDay) }} упражнения за активный день
      </p>

      <section class="space-y-2" data-testid="zone-list">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Распределение по зонам
        </h2>
        <div
          v-for="zone in summary.zones"
          :key="zone.category"
          class="space-y-1"
          :data-zone="zone.category"
        >
          <div class="flex justify-between text-xs">
            <span class="text-slate-300">{{ zone.category }}</span>
            <span class="text-slate-500">{{ zone.count }} · {{ percent(zone.share) }}</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              class="h-full rounded-full bg-emerald-500"
              :style="{ width: `${Math.round(zone.share * 100)}%` }"
            />
          </div>
        </div>
      </section>

      <section v-if="summary.groups.length" class="flex flex-wrap gap-1">
        <span
          v-for="group in summary.groups"
          :key="group.group"
          class="rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-slate-400"
        >
          {{ groupLabels[group.group] ?? group.group }}: {{ group.count }}
        </span>
      </section>

      <section class="space-y-1" data-testid="top-exercises">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Чаще всего
        </h2>
        <ul class="space-y-1">
          <li
            v-for="exercise in summary.topExercises"
            :key="exercise.exerciseId"
            class="flex justify-between rounded-lg bg-slate-900 px-2 py-1 text-xs"
          >
            <span class="text-slate-300">{{ exercise.title }}</span>
            <span class="text-slate-500">{{ exercise.count }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
