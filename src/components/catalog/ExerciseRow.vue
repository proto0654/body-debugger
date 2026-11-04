<script setup lang="ts">
import { computed } from 'vue'
import { METHOD_LABELS, ZONE_LABELS } from '@shared/constants/catalog-axes'
import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import { plannedExerciseSeconds } from '@shared/domain/exercise-start'
import type { ExerciseV2Resolved } from '@shared/types/exercise-v2'
import type { PickCandidate } from '@shared/domain/picker'
import { useSettingsStore } from '@/stores/settings'
const props = defineProps<{ exercise: ExerciseV2Resolved; candidate?: PickCandidate; batchName?: string; hints?: string[]; selected?: boolean }>()
defineEmits<{ select: [] }>()
const settings = useSettingsStore()
const seconds = computed(() => plannedExerciseSeconds(props.exercise, settings.asSettings()))
const equipment = computed(() => props.exercise.equipment?.length ? props.exercise.equipment.map(id => EQUIPMENT_CATALOG.find(item => item.id === id)?.title ?? id).join(', ') : 'Без инвентаря')
</script>
<template>
  <button type="button" class="exercise-list-item" :aria-pressed="!!selected" @click="$emit('select')">
    <span class="text-xl" aria-hidden="true">{{ exercise.emojiFallback }}</span>
    <span class="min-w-0 space-y-1"><strong class="block text-sm font-semibold text-white">{{ exercise.title }}</strong><span class="block text-xs text-slate-300">{{ seconds }} с · {{ ZONE_LABELS[exercise.dominantZone] }} · {{ METHOD_LABELS[exercise.method] }}</span><span class="block text-xs text-slate-400">{{ equipment }}</span></span>
  </button>
</template>
