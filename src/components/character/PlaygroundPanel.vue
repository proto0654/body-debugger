<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'
import CharacterChronicle from './CharacterChronicle.vue'
import ManualCharacterControls from './ManualCharacterControls.vue'
import PlaygroundLabWebview from './PlaygroundLabWebview.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { defaultManualState, type CharacterContext, type ManualCharacterState } from '@shared/domain/character-context'

const props = defineProps<{ now: Date }>()
type ContextId = 'main' | 'lab'

const source = ref<ContextId>('main')
const sessions = useSessionsStore()
const settings = useSettingsStore()
const progress = useProgressStore()
const mainManual = ref<ManualCharacterState | null>(null)

const mainContext = computed<CharacterContext>(() => ({
  id: 'main',
  title: 'Основной персонаж',
  sessions: sessions.history,
  packId: settings.characterPackId,
  build: progress.characterBuild,
  allowStart: false,
  manual: mainManual.value
}))
const mainDefaults = computed(() => defaultManualState(mainContext.value, props.now))
const items = [
  { id: 'main' as const, label: 'Основной персонаж' },
  { id: 'lab' as const, label: 'Лаборатория' }
]
</script>

<template>
  <section class="playground space-y-4" data-testid="playground">
    <header class="settings-card space-y-2">
      <p class="brand-label text-amber-300">ПЛЕЙГРАУНД</p>
      <h2 class="text-xl font-semibold text-white">Временные контексты</h2>
      <p class="max-w-3xl text-sm leading-relaxed text-slate-400">Основной персонаж и лаборатория в одном месте. Контекст основного персонажа — только просмотр: реальная история, настройки и прогресс не меняются. Лаборатория работает в своём тестовом профиле и открывается ниже.</p>
    </header>

    <SectionTabs v-model="source" :items="items" label="Контекст плейграунда">
      <template v-if="source === 'main'">
        <ManualCharacterControls v-model="mainManual" :defaults="mainDefaults" :pack-id="mainContext.packId" />
        <CharacterChronicle :key="mainContext.id" :now="now" :context="mainContext" />
      </template>
      <PlaygroundLabWebview v-else />
    </SectionTabs>
  </section>
</template>
