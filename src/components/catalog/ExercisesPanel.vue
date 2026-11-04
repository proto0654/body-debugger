<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'
import CatalogLibrary from './CatalogLibrary.vue'
import SetsPanel from './SetsPanel.vue'
import AiPanel from './AiPanel.vue'
import QueueStrip from './QueueStrip.vue'
import ManualEditPanel from './ManualEditPanel.vue'
import AiProposalPanel from '@/components/ai/AiProposalPanel.vue'
import PreferencesPanel from '@/components/settings/PreferencesPanel.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useSettingsStore } from '@/stores/settings'
import { useDashboardNavigation } from '@/stores/dashboard-navigation'
const catalog = useCatalogStore()
const settings = useSettingsStore()
const navigation = useDashboardNavigation()
const section = computed({ get: () => navigation.location.section, set: value => navigation.navigate('exercises', value) })
const items = [{ id: 'library', label: 'Каталог' }, { id: 'profile', label: 'Подбор под меня' }, { id: 'sets', label: 'Наборы' }, { id: 'queue', label: 'Следующие перерывы' }, { id: 'ai', label: 'ИИ-помощник' }]
watch(() => navigation.location.exerciseId, id => { if (section.value === 'edit') catalog.editExerciseId = id ?? null }, { immediate: true })
onMounted(() => { void catalog.refresh() })
</script>
<template>
  <div class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-2xl font-semibold">Упражнения</h1><button type="button" class="setting-chip" @click="navigation.navigate('exercises', 'import')">Импорт JSON</button></div>
  <SectionTabs v-if="section !== 'import' && section !== 'edit'" v-model="section" :items="items" label="Упражнения и подбор">
    <CatalogLibrary v-if="section === 'library'" />
    <PreferencesPanel v-else-if="section === 'profile'" group="selection" />
    <SetsPanel v-else-if="section === 'sets'" />
    <QueueStrip v-else-if="section === 'queue'" />
    <AiPanel v-else />
  </SectionTabs>
  <template v-else-if="section === 'import'"><button type="button" class="setting-chip" @click="navigation.navigate('exercises')">← Каталог</button><section class="settings-card space-y-4"><label class="flex items-center gap-2"><input type="checkbox" :checked="settings.ai.enabled" @change="settings.setAiEnabled(($event.target as HTMLInputElement).checked)">Разрешить импорт упражнений</label><AiProposalPanel :enabled="settings.ai.enabled" /></section></template>
  <template v-else><button type="button" class="setting-chip" @click="navigation.navigate('exercises', 'library', { exerciseId: navigation.location.exerciseId })">← К упражнению</button><ManualEditPanel /></template>
</template>
