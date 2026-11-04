<script setup lang="ts">
import { computed } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'
import PreferencesPanel from './PreferencesPanel.vue'
import ComfortSettingsPanel from './ComfortSettingsPanel.vue'
import SystemPanel from './SystemPanel.vue'
import AboutPanel from './AboutPanel.vue'
import AiConnectionPanel from './AiConnectionPanel.vue'
import SandboxPanel from '@/components/catalog/SandboxPanel.vue'
import CoveragePanel from '@/components/catalog/CoveragePanel.vue'
import { useDashboardNavigation } from '@/stores/dashboard-navigation'
import { useCatalogStore } from '@/stores/catalog'

const navigation = useDashboardNavigation()
const catalog = useCatalogStore()
const developerSections = ['developer', 'laboratory', 'sandbox', 'coverage']
const section = computed({ get: () => developerSections.includes(navigation.location.section) ? 'developer' : navigation.location.section, set: value => navigation.navigate('settings', value) })
const items = [{ id: 'general', label: 'Напоминания' }, { id: 'comfort', label: 'Удобство' }, { id: 'system', label: 'Система' }, { id: 'ai', label: 'Подключение ИИ' }, { id: 'developer', label: 'Для разработчика' }]
</script>

<template>
  <SectionTabs v-model="section" :items="items" label="Настройки приложения">
    <PreferencesPanel v-if="section === 'general'" group="general" />
    <ComfortSettingsPanel v-else-if="section === 'comfort'" group="presentation" />
    <template v-else-if="section === 'system'"><SystemPanel /><AboutPanel /></template>
    <AiConnectionPanel v-else-if="section === 'ai'" />
    <template v-else>
      <div class="flex flex-wrap gap-2"><button v-for="item in [{ id: 'laboratory', label: 'Лаборатория' }, { id: 'sandbox', label: 'Симуляция подбора' }, { id: 'coverage', label: 'Матрица покрытия' }]" :key="item.id" type="button" class="setting-chip" :aria-pressed="navigation.location.section === item.id" @click="catalog.refresh(); navigation.navigate('settings', item.id)">{{ item.label }}</button></div>
      <p class="text-sm text-slate-400">Диагностика и моделирование. Лаборатория работает в отдельном тестовом профиле.</p>
      <SandboxPanel v-if="navigation.location.section === 'sandbox'" />
      <CoveragePanel v-else-if="navigation.location.section === 'coverage'" />
      <slot v-else-if="navigation.location.section === 'laboratory'" />
    </template>
  </SectionTabs>
</template>
