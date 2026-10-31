<script setup lang="ts">
import { computed } from 'vue'
import { useSessionsStore } from '@/stores/sessions'
import { characterJourney } from '@shared/domain/character-progress'
import { CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import type { CharacterStage } from '@shared/types/character'
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const sessions = useSessionsStore()
const journey = computed(() => characterJourney(sessions.history))
const stages: CharacterStage[] = [0, 1, 2, 3, 4, 5]
const remainingLabel = computed(() => {
  const count = journey.value.remaining
  const plural = new Intl.PluralRules('ru-RU').select(count)
  return `Ещё ${count} ${plural === 'one' ? 'разминка' : plural === 'few' ? 'разминки' : 'разминок'}`
})
</script>

<template>
  <section class="settings-card space-y-4" data-testid="character-journey">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div><p class="brand-label text-slate-400">ТВОЯ ЭВОЛЮЦИЯ</p><h2 class="mt-1 text-sm font-semibold text-white">{{ journey.nextStage === null ? 'Пиковая форма достигнута' : `Следующая форма: ${CHARACTER_STAGE_LABELS[journey.nextStage]}` }}</h2></div>
      <p class="text-xs text-emerald-400">{{ journey.nextStage === null ? 'Продолжай в своём ритме' : remainingLabel }}</p>
    </div>
    <div class="journey-track" role="progressbar" aria-label="До следующей формы" :aria-valuenow="Math.round(journey.ratio * 100)" aria-valuemin="0" aria-valuemax="100"><div :style="{ width: `${journey.ratio * 100}%` }" /></div>
    <ol v-if="!compact" class="journey-stages"><li v-for="stage in stages" :key="stage" :class="{ reached: stage <= journey.stage, current: stage === journey.stage }" :aria-current="stage === journey.stage ? 'step' : undefined"><span>{{ stage + 1 }}</span><p>{{ CHARACTER_STAGE_LABELS[stage] }}</p></li></ol>
  </section>
</template>
