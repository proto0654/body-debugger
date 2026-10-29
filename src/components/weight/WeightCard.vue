<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import WeightSparkline from './WeightSparkline.vue'
import { useSettingsStore } from '@/stores/settings'
import { useWeightStore } from '@/stores/weight'
import {
  WEIGHT_HISTORY_DAYS,
  WEIGHT_KG_RANGE,
  weightChangeKg,
  weightTargetGapKg
} from '@shared/domain/weight'

const settings = useSettingsStore()
const weight = useWeightStore()

/** Snapshot of "now": the card is a dashboard view, not a live clock. */
const now = new Date()

const series = computed(() => weight.series(now))
const latest = computed(() => weight.latest)
const recent = computed(() => weight.recent(5))
const change = computed(() => weightChangeKg(series.value))
const targetGap = computed(() =>
  latest.value !== null && settings.weight.targetKg !== null
    ? weightTargetGapKg(latest.value.weightKg, settings.weight.targetKg)
    : null
)

const weightInput = ref<string | number>('')
const targetInput = ref<string | number>(settings.weight.targetKg?.toString() ?? '')
const error = ref('')
const busy = ref(false)

watch(
  () => settings.weight.targetKg,
  (targetKg) => {
    targetInput.value = targetKg?.toString() ?? ''
  }
)

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

const changeLabel = computed(() => {
  if (change.value === null) return 'Добавьте вторую запись, чтобы увидеть динамику'
  if (change.value === 0) return `Без изменений за ${WEIGHT_HISTORY_DAYS} дней`
  const sign = change.value > 0 ? '+' : '−'
  return `${sign}${Math.abs(change.value).toFixed(1)} кг за ${WEIGHT_HISTORY_DAYS} дней`
})

const targetLabel = computed(() => {
  const gap = targetGap.value
  const target = settings.weight.targetKg
  if (gap === null || target === null) return ''
  if (gap === 0) return `Цель ${target} кг достигнута`

  // Arrow points from the current weight towards the goal.
  const direction = gap > 0 ? '−' : '+'
  return `Цель ${target} кг · ${direction}${Math.abs(gap).toFixed(1)} кг`
})

/** `type="number"` hands Vue a number; empty input stays a string. */
function inputText(value: string | number): string {
  return String(value).trim()
}

function parseInput(value: string | number): number {
  return Number(inputText(value).replace(',', '.'))
}

async function submit(): Promise<void> {
  const raw = inputText(weightInput.value)
  if (raw === '') {
    error.value = 'Введите вес'
    return
  }

  busy.value = true
  const saved = await weight.add(parseInput(raw))
  busy.value = false

  if (!saved) {
    error.value = `Вес должен быть от ${WEIGHT_KG_RANGE.min} до ${WEIGHT_KG_RANGE.max} кг`
    return
  }

  error.value = ''
  weightInput.value = ''
}

async function commitTarget(): Promise<void> {
  const raw = inputText(targetInput.value)
  await settings.setWeightTarget(raw === '' ? null : parseInput(raw))
}
</script>

<template>
  <section
    class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
    data-testid="weight-card"
  >
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-sm font-semibold text-slate-100">Вес</h2>
        <p class="text-xs text-slate-500">История за {{ WEIGHT_HISTORY_DAYS }} дней</p>
      </div>
      <label class="flex items-center gap-2 text-xs text-slate-500">
        Цель, кг
        <input
          v-model="targetInput"
          data-testid="weight-target"
          type="number"
          :min="WEIGHT_KG_RANGE.min"
          :max="WEIGHT_KG_RANGE.max"
          step="0.1"
          inputmode="decimal"
          placeholder="—"
          class="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
          @blur="commitTarget"
          @keyup.enter="commitTarget"
        />
      </label>
    </header>

    <div v-if="latest" class="mt-3 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div class="space-y-1">
        <p class="text-3xl font-semibold tabular-nums text-white" data-testid="weight-latest">
          {{ latest.weightKg.toFixed(1) }}
          <span class="text-sm font-normal text-slate-400">кг</span>
        </p>
        <p class="text-xs text-slate-500" data-testid="weight-change">{{ changeLabel }}</p>
        <p v-if="targetLabel" class="text-xs text-slate-500" data-testid="weight-target-gap">
          {{ targetLabel }}
        </p>
      </div>
      <WeightSparkline
        v-if="series.length > 0"
        :points="series"
        class="text-emerald-400"
      />
    </div>
    <p v-else class="mt-3 text-xs text-slate-500">
      Записей пока нет. Взвесьтесь и добавьте первое измерение.
    </p>

    <form class="mt-4 flex flex-wrap items-end gap-2" @submit.prevent="submit">
      <label class="flex flex-col gap-1 text-[11px] text-slate-500">
        Вес, кг
        <input
          v-model="weightInput"
          data-testid="weight-input"
          type="number"
          :min="WEIGHT_KG_RANGE.min"
          :max="WEIGHT_KG_RANGE.max"
          step="0.1"
          inputmode="decimal"
          placeholder="72.5"
          class="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
        />
      </label>
      <button
        type="submit"
        data-testid="weight-add"
        class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        :disabled="busy"
      >
        Записать
      </button>
      <p v-if="error" class="text-xs text-amber-400" data-testid="weight-error">{{ error }}</p>
    </form>

    <ul v-if="recent.length > 0" class="mt-3 divide-y divide-slate-800">
      <li
        v-for="entry in recent"
        :key="entry.id"
        class="flex items-center justify-between py-1 text-xs text-slate-400"
      >
        <span>
          {{ formatDate(entry.at) }}
          <span v-if="entry.sessionId" class="text-slate-600">· после упражнения</span>
        </span>
        <span class="flex items-center gap-3">
          <span class="tabular-nums text-slate-200">{{ entry.weightKg.toFixed(1) }} кг</span>
          <button
            type="button"
            class="text-slate-600 transition hover:text-rose-400"
            :aria-label="`Удалить запись ${entry.weightKg} кг`"
            @click="weight.remove(entry.id)"
          >
            ×
          </button>
        </span>
      </li>
    </ul>
  </section>
</template>
