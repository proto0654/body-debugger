<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'
import CalendarHeatmap from './CalendarHeatmap.vue'
import StatsPanel from './StatsPanel.vue'
import WeightCard from '@/components/weight/WeightCard.vue'
import PhotoGallery from '@/components/photos/PhotoGallery.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { usePhotosStore } from '@/stores/photos'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { mergeCatalogs } from '@shared/domain/ai-proposal'

type ProgressSection = 'calendar' | 'stats' | 'weight' | 'photos'
const props = withDefaults(defineProps<{ now: Date; initialSection?: ProgressSection }>(), { initialSection: 'calendar' })
defineEmits<{ settings: [] }>()
const section = ref<ProgressSection>(props.initialSection)
watch(() => props.initialSection, value => { section.value = value })
const items: { id: ProgressSection; label: string }[] = [{ id: 'calendar', label: 'Календарь' }, { id: 'stats', label: 'Статистика' }, { id: 'weight', label: 'Вес' }, { id: 'photos', label: 'Фотографии' }]
const sessions = useSessionsStore()
const settings = useSettingsStore()
const photos = usePhotosStore()
const custom = useCustomExercisesStore()
const catalog = computed(() => mergeCatalogs(EXERCISE_CATALOG, custom.entries))
</script>

<template>
  <SectionTabs v-model="section" :items="items" label="Разделы прогресса">
    <section v-if="section === 'calendar'" class="settings-card space-y-4"><h2 class="text-sm font-semibold text-white">Активность за 13 недель</h2><CalendarHeatmap :sessions="sessions.history" :catalog="catalog" :now="now" /></section>
    <section v-else-if="section === 'stats'" class="settings-card space-y-4"><h2 class="text-sm font-semibold text-white">Твоя статистика</h2><StatsPanel :sessions="sessions.history" :catalog="catalog" :now="now" /></section>
    <WeightCard v-else-if="section === 'weight' && settings.weight.enabled" />
    <section v-else-if="section === 'photos' && settings.photos.enabled" class="settings-card space-y-4"><h2 class="text-sm font-semibold text-white">Фото прогресса</h2><PhotoGallery :photos="photos.entries" @remove="photos.remove" /><p class="text-xs text-slate-400">Добавить фото можно в деталях разминки.</p></section>
    <section v-else class="settings-card space-y-3"><h2 class="text-sm font-semibold text-white">{{ section === 'weight' ? 'История веса' : 'Фото прогресса' }}</h2><p class="text-sm text-slate-400">Включи эту функцию в настройках, когда она понадобится.</p><button type="button" class="setting-chip" @click="$emit('settings')">Открыть настройки →</button></section>
  </SectionTabs>
</template>
