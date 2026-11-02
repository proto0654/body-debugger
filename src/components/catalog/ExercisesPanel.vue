<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'
import CatalogLibrary from '@/components/catalog/CatalogLibrary.vue'
import SandboxPanel from '@/components/catalog/SandboxPanel.vue'
import CoveragePanel from '@/components/catalog/CoveragePanel.vue'
import SetsPanel from '@/components/catalog/SetsPanel.vue'
import AiPanel from '@/components/catalog/AiPanel.vue'
import { useCatalogStore, type ExercisesSection } from '@/stores/catalog'
import { useSandboxStore } from '@/stores/sandbox'

const catalog = useCatalogStore()
const sandbox = useSandboxStore()
let unsubscribe: (() => void) | undefined

const items: { id: ExercisesSection; label: string }[] = [
  { id: 'library', label: 'Каталог' },
  { id: 'sandbox', label: 'Песочница' },
  { id: 'coverage', label: 'Покрытие' },
  { id: 'sets', label: 'Наборы' },
  { id: 'ai', label: 'AI' }
]

onMounted(() => {
  void catalog.refresh()
  if (!sandbox.controls) sandbox.resetFromReal()
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
    <CatalogLibrary v-if="catalog.section === 'library'" />
    <SandboxPanel v-else-if="catalog.section === 'sandbox'" />
    <CoveragePanel v-else-if="catalog.section === 'coverage'" />
    <SetsPanel v-else-if="catalog.section === 'sets'" />
    <AiPanel v-else />
  </SectionTabs>
</template>
