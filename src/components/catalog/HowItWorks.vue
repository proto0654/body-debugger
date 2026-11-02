<script setup lang="ts">
import { computed } from 'vue'
import {
  DOSE_BASE_INTERVAL,
  DOSE_EXPONENT,
  INTENSITY_CAP_LONG,
  INTENSITY_CAP_SHORT,
  LEVEL_MULT,
  OVERLAP_PREV_WEIGHT,
  OVERLAP_TODAY_WEIGHT
} from '@shared/constants/catalog-tuning'
import { FIELD_DOCS, EFFECTIVE_POOL_WARN_THRESHOLD } from '@shared/constants/field-docs'
import { doseMultiplier } from '@shared/domain/dose'
import FieldHelp from '@/components/catalog/FieldHelp.vue'

const tuningDocs = computed(() => FIELD_DOCS.filter((doc) => doc.key.startsWith('tuning.')))

const doseCurve = computed(() =>
  [15, 30, 45, 60, 90, 120].map((minutes) => ({
    minutes,
    mult: doseMultiplier(minutes)
  }))
)
</script>

<template>
  <section class="settings-card space-y-4" data-testid="catalog-how-it-works">
    <div>
      <h2 class="text-sm font-semibold text-white">Как это работает</h2>
      <p class="mt-1 text-xs text-slate-400">
        Константы из <code class="text-slate-300">catalog-tuning.ts</code> и смысл каждого числа.
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
        <p class="font-medium text-slate-200">
          Overlap prev
          <FieldHelp field-key="tuning.OVERLAP_PREV_WEIGHT" />
        </p>
        <p class="mt-1 text-emerald-300">{{ OVERLAP_PREV_WEIGHT }}</p>
      </div>
      <div class="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
        <p class="font-medium text-slate-200">
          Overlap today
          <FieldHelp field-key="tuning.OVERLAP_TODAY_WEIGHT" />
        </p>
        <p class="mt-1 text-emerald-300">{{ OVERLAP_TODAY_WEIGHT }}</p>
      </div>
      <div class="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
        <p class="font-medium text-slate-200">
          Level multipliers
          <FieldHelp field-key="tuning.LEVEL_MULT" />
        </p>
        <p class="mt-1 text-emerald-300">
          − {{ LEVEL_MULT[-1] }} · 0 {{ LEVEL_MULT[0] }} · + {{ LEVEL_MULT[1] }} · ++ {{ LEVEL_MULT[2] }}
        </p>
      </div>
      <div class="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
        <p class="font-medium text-slate-200">
          Dose exponent
          <FieldHelp field-key="tuning.DOSE_EXPONENT" />
        </p>
        <p class="mt-1 text-emerald-300">{{ DOSE_EXPONENT }} (база {{ DOSE_BASE_INTERVAL }} мин)</p>
      </div>
      <div class="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
        <p class="font-medium text-slate-200">
          Intensity caps
          <FieldHelp field-key="tuning.INTENSITY_CAP" />
        </p>
        <p class="mt-1 text-emerald-300">
          ≤{{ INTENSITY_CAP_SHORT }} → 2 · &lt;{{ INTENSITY_CAP_LONG }} → 3 · иначе 5
        </p>
      </div>
      <div class="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
        <p class="font-medium text-slate-200">
          Тонкий пул
          <FieldHelp field-key="tuning.EFFECTIVE_POOL_WARN" />
        </p>
        <p class="mt-1 text-emerald-300">&lt; {{ EFFECTIVE_POOL_WARN_THRESHOLD }}</p>
      </div>
    </div>

    <div>
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Доза vs интервал</h3>
      <ul class="mt-2 space-y-1">
        <li v-for="point in doseCurve" :key="point.minutes" class="flex items-center gap-2 text-xs text-slate-400">
          <span class="w-14">{{ point.minutes }} мин</span>
          <div class="h-1.5 flex-1 rounded bg-slate-800">
            <div class="h-full rounded bg-emerald-500/80" :style="{ width: `${Math.min(100, point.mult * 50)}%` }" />
          </div>
          <span class="w-12 text-right text-slate-300">×{{ point.mult.toFixed(2) }}</span>
        </li>
      </ul>
    </div>

    <div>
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Поля упражнения</h3>
      <ul class="mt-2 divide-y divide-slate-800 text-xs">
        <li v-for="doc in FIELD_DOCS.filter((d) => !d.key.startsWith('tuning.'))" :key="doc.key" class="py-2">
          <p class="font-medium text-slate-200">
            {{ doc.label }}
            <FieldHelp :field-key="doc.key" />
          </p>
          <p class="text-slate-500">{{ doc.what }}</p>
        </li>
      </ul>
    </div>

    <ul class="hidden">
      <li v-for="doc in tuningDocs" :key="doc.key">{{ doc.key }}</li>
    </ul>
  </section>
</template>
