<script setup lang="ts">
import type { PickFactor } from '@shared/domain/picker'

defineProps<{ factors: readonly PickFactor[] }>()

const LABELS: Record<PickFactor['key'], string> = {
  prev: 'повтор',
  today: 'сегодня',
  method: 'метод',
  neglect: 'neglect',
  profile: 'профиль',
  mode: 'режим'
}

function tone(mult: number): string {
  if (mult > 1.05) return 'border-emerald-700/60 bg-emerald-500/10 text-emerald-300'
  if (mult < 0.95) return 'border-amber-700/60 bg-amber-500/10 text-amber-300'
  return 'border-slate-700 bg-slate-800/60 text-slate-400'
}
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <span
      v-for="factor in factors"
      :key="factor.key"
      class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
      :class="tone(factor.mult)"
      :title="factor.note"
    >
      <span aria-hidden="true">{{ factor.mult >= 1 ? '↑' : '↓' }}</span>
      {{ LABELS[factor.key] }} ×{{ factor.mult.toFixed(2) }}
      <span class="text-slate-500">— {{ factor.note }}</span>
    </span>
  </div>
</template>
