<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'
import CoveragePanel from '@/components/catalog/CoveragePanel.vue'
import PickPanel from '@/components/catalog/PickPanel.vue'
import SetsPanel from '@/components/catalog/SetsPanel.vue'
import AiPanel from '@/components/catalog/AiPanel.vue'
import { useCatalogStore, type ExercisesSection } from '@/stores/catalog'

const catalog = useCatalogStore()
let unsubscribe: (() => void) | undefined

const items: { id: ExercisesSection; label: string }[] = [
  { id: 'coverage', label: 'Покрытие' },
  { id: 'pick', label: 'Выбор' },
  { id: 'sets', label: 'Наборы' },
  { id: 'ai', label: 'AI' }
]

onMounted(() => {
  void catalog.refresh()
  unsubscribe = window.api?.onCatalogUpdated?.((payload) => {
    catalog.applyCatalogFile(payload.catalog)
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <SectionTabs v-model="catalog.section" :items="items" label="Каталог упражнений">
    <CoveragePanel v-if="catalog.section === 'coverage'" />
    <PickPanel v-else-if="catalog.section === 'pick'" />
    <SetsPanel v-else-if="catalog.section === 'sets'" />
    <AiPanel v-else />
  </SectionTabs>
</template>
