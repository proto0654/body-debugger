<script setup lang="ts">
import { nowDate } from '@shared/domain/clock'
import { computed, ref } from 'vue'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import {
  buildHeatmap,
  localDateKey,
  type DayActivity
} from '@shared/domain/stats'
import type { Exercise } from '@shared/types/exercise'
import type { Session } from '@shared/types/session'

const props = withDefaults(
  defineProps<{
    sessions: Session[]
    /** Injectable clock so the grid is deterministic in tests */
    now?: Date
    days?: number
    /** Shipped + approved catalog for day titles */
    catalog?: readonly Exercise[]
  }>(),
  {
    now: () => nowDate(),
    days: 91,
    catalog: () => EXERCISE_CATALOG
  }
)

const catalogById = computed(
  () => new Map(props.catalog.map((exercise) => [exercise.id, exercise]))
)
const heatmap = computed(() => buildHeatmap(props.sessions, { days: props.days, now: props.now }))

const selectedDate = ref<string | null>(localDateKey(props.now))

const levels = [
  'bg-slate-800',
  'bg-emerald-900',
  'bg-emerald-700',
  'bg-emerald-500'
] as const

const weekdayLabels = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс']

function displayDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

function cellTitle(day: DayActivity): string {
  return `${displayDate(day.date)} · ${day.done} выполнено · ${day.total} всего`
}

const selectedDay = computed(
  () => heatmap.value.days.find((day) => day.date === selectedDate.value) ?? null
)

const selectedSessions = computed(() => {
  if (!selectedDate.value) return []
  return props.sessions.filter((session) => {
    const parsed = Date.parse(session.completedAt ?? session.triggeredAt)
    return !Number.isNaN(parsed) && localDateKey(new Date(parsed)) === selectedDate.value
  })
})

const selectedTitles = computed(() => {
  const titles = new Set<string>()
  for (const session of selectedSessions.value) {
    if (session.status !== 'done') continue
    titles.add(catalogById.value.get(session.exerciseId)?.title ?? session.exerciseId)
  }
  return Array.from(titles)
})

function select(day: DayActivity): void {
  selectedDate.value = day.date
}
</script>

<template>
  <section class="space-y-3" data-testid="calendar-heatmap">
    <div class="flex gap-2">
      <div class="grid grid-rows-7 gap-1 pt-0.5 text-[9px] leading-3 text-slate-600">
        <span v-for="(label, index) in weekdayLabels" :key="index">{{ label }}</span>
      </div>
      <div class="flex gap-1 overflow-x-auto pb-1" data-testid="heatmap-grid">
        <div v-for="(week, weekIndex) in heatmap.weeks" :key="weekIndex" class="grid grid-rows-7 gap-1">
          <template v-for="(day, dayIndex) in week" :key="day?.date ?? `${weekIndex}-${dayIndex}`">
            <button
              v-if="day"
              type="button"
              class="h-3.5 w-3.5 rounded-[3px] transition hover:ring-1 hover:ring-slate-500"
              :class="[
                levels[day.level],
                selectedDate === day.date ? 'ring-1 ring-emerald-400' : ''
              ]"
              :data-testid="'heatmap-cell'"
              :data-date="day.date"
              :data-level="day.level"
              :title="cellTitle(day)"
              :aria-label="cellTitle(day)"
              @click="select(day)"
            />
            <span v-else class="h-3.5 w-3.5 rounded-[3px] bg-transparent" />
          </template>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2 text-[10px] text-slate-500">
      <span data-testid="heatmap-day">
        <template v-if="selectedDay">
          {{ displayDate(selectedDay.date) }}: {{ selectedDay.done }} выполнено,
          {{ selectedDay.skipped }} пропущено, {{ selectedDay.snoozed }} отложено,
          {{ selectedDay.missed }} пропущено по таймауту
          <span v-if="selectedTitles.length" class="text-slate-400">
            · {{ selectedTitles.join(', ') }}
          </span>
        </template>
      </span>
      <span class="flex items-center gap-1" data-testid="heatmap-legend">
        меньше
        <i v-for="level in levels" :key="level" class="h-2.5 w-2.5 rounded-[2px]" :class="level" />
        больше
      </span>
    </div>
  </section>
</template>
