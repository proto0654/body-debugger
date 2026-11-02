<script setup lang="ts">
import { COVERAGE_THRESHOLD } from '@shared/constants/catalog-tuning'
import { METHODS, METHOD_LABELS, ZONES, ZONE_LABELS } from '@shared/constants/catalog-axes'
import type { Method, Zone } from '@shared/types/exercise-v2'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()

function cell(zone: Zone, method: Method) {
  return catalog.coverage.find((entry) => entry.zone === zone && entry.method === method)
}

function cellTooltip(zone: Zone, method: Method): string {
  const matches = catalog.resolved.filter(
    (exercise) =>
      exercise.status === 'active' &&
      exercise.dominantZone === zone &&
      exercise.method === method
  )
  if (matches.length === 0) return 'Пусто'
  const lines = matches.slice(0, 8).map((exercise) => {
    const shares = ZONES.filter((key) => (exercise.zones[key] ?? 0) > 0)
      .map((key) => `${ZONE_LABELS[key]} ${Math.round((exercise.zones[key] ?? 0) * 100)}%`)
      .join(', ')
    return `${exercise.title}: ${shares || ZONE_LABELS[zone]}`
  })
  if (matches.length > 8) lines.push(`…ещё ${matches.length - 8}`)
  return lines.join('\n')
}

function generate(zone: Zone, method: Method): void {
  catalog.openAiForCell({ zone, method })
}
</script>

<template>
  <section class="settings-card space-y-4" data-testid="catalog-coverage">
    <div>
      <h2 class="text-sm font-semibold text-white">Матрица зона × метод</h2>
      <p class="mt-1 text-xs text-slate-400">
        Считаются активные упражнения с доминирующей зоной и методом. Порог — {{ COVERAGE_THRESHOLD }} шт.
      </p>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr>
            <th class="border border-slate-800 bg-slate-950/60 p-2 text-left font-medium text-slate-500">Зона</th>
            <th
              v-for="method in METHODS"
              :key="method"
              class="border border-slate-800 bg-slate-950/60 p-2 text-center font-medium text-slate-400"
            >
              {{ METHOD_LABELS[method] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="zone in ZONES" :key="zone">
            <th class="border border-slate-800 bg-slate-950/40 p-2 text-left font-medium text-slate-300">
              {{ ZONE_LABELS[zone] }}
            </th>
            <td
              v-for="method in METHODS"
              :key="method"
              class="border border-slate-800 p-2 text-center align-middle"
              :class="cell(zone, method)?.belowThreshold ? 'bg-amber-400/10' : 'bg-slate-900/30'"
              :title="cellTooltip(zone, method)"
            >
              <template v-if="cell(zone, method)">
                <p class="text-base font-semibold text-white">{{ cell(zone, method)!.count }}</p>
                <p v-if="cell(zone, method)!.count > 0" class="mt-0.5 text-slate-500">
                  ср. {{ cell(zone, method)!.avgIntensity.toFixed(1) }}
                </p>
                <button
                  v-if="cell(zone, method)!.belowThreshold"
                  type="button"
                  class="setting-chip mt-2 text-[11px]"
                  @click="generate(zone, method)"
                >
                  Сгенерировать
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
