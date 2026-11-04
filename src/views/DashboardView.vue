<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { nowDate } from '@shared/domain/clock'
import { reactionDuration } from '@shared/domain/reaction-timing'
import { characterJourney } from '@shared/domain/character-progress'
import { computeStreak } from '@shared/domain/streak'
import { localDateKey } from '@shared/domain/stats'
import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import type { CharacterReactionEvent } from '@shared/domain/character-reaction'
import type { CharacterContext } from '@shared/domain/character-context'
import CharacterSettingsPanel from '@/components/character/CharacterSettingsPanel.vue'
import CharacterJourney from '@/components/character/CharacterJourney.vue'
import CharacterChronicle from '@/components/character/CharacterChronicle.vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import LaboratoryHost from '@/debug/LaboratoryHost.vue'
import SectionTabs from '@/components/SectionTabs.vue'
import ProgressPanel from '@/components/stats/ProgressPanel.vue'
import WeightCard from '@/components/weight/WeightCard.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import ExercisesPanel from '@/components/catalog/ExercisesPanel.vue'
import { useRuntimeStore } from '@/stores/runtime'
import { useProgressStore } from '@/stores/progress'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { useReminderStore } from '@/stores/reminder'
import { useSessionsStore } from '@/stores/sessions'
import { useQueueStore } from '@/stores/queue'
import { useCatalogStore } from '@/stores/catalog'
import { useDashboardNavigation } from '@/stores/dashboard-navigation'
import { useExerciseStartStore } from '@/stores/exercise-start'
import type { DashboardTab } from '@shared/domain/dashboard-navigation'

const navigation = useDashboardNavigation()
const tab = computed(() => navigation.location.tab)
const section = computed(() => navigation.location.section)
const characterSection = computed({ get: () => section.value, set: value => navigation.navigate('character', value) })
const runtime = useRuntimeStore()
const progress = useProgressStore()
const character = useCharacterStore()
const settings = useSettingsStore()
const reminder = useReminderStore()
const sessions = useSessionsStore()
const breakQueue = useQueueStore()
const catalog = useCatalogStore()
const exerciseStart = useExerciseStartStore()
const now = ref(nowDate())
const celebration = ref('')
const reactionActive = ref(false)
const actionError = ref('')
const laboratoryActive = computed(() => tab.value === 'settings' && section.value === 'laboratory')
const chronicleContext = computed<CharacterContext>(() => ({ id: 'main', title: 'Основной персонаж', sessions: sessions.history, packId: settings.characterPackId, build: progress.characterBuild, allowStart: true, manual: null }))
const journey = computed(() => characterJourney(sessions.history))
const streak = computed(() => computeStreak(sessions.history, now.value))
const todayDone = computed(() => sessions.history.filter(session => session.status === 'done' && localDateKey(new Date(session.completedAt ?? session.triggeredAt)) === localDateKey(now.value)).length)
const dateLabel = computed(() => now.value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }))
const tabs: { id: DashboardTab; label: string }[] = [{ id: 'today', label: 'Сегодня' }, { id: 'exercises', label: 'Упражнения' }, { id: 'character', label: 'Персонаж' }, { id: 'progress', label: 'Прогресс' }]
let clock: ReturnType<typeof setInterval> | undefined
let reactionTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribeNavigation: (() => void) | undefined
let unsubscribeCatalog: (() => void) | undefined
function refreshClock(): void { now.value = nowDate() }
watch(() => runtime.revision, refreshClock, { flush: 'sync' })
watch(() => [settings.asSettings(), sessions.history, breakQueue.queue, now.value], () => { void exerciseStart.refresh() }, { deep: true })
onMounted(() => {
  resetReaction()
  void catalog.refresh()
  void breakQueue.refresh()
  void exerciseStart.refresh()
  clock = setInterval(refreshClock, 30_000)
  document.addEventListener('visibilitychange', refreshClock)
  window.addEventListener('hashchange', navigation.read)
  window.addEventListener('popstate', navigation.read)
  unsubscribeNavigation = window.api?.onNavigateDashboard?.(payload => navigation.navigate(payload.tab))
  unsubscribeCatalog = window.api?.onCatalogUpdated?.(payload => { catalog.applyCatalogFile(payload.catalog); void exerciseStart.refresh() })
})
onBeforeUnmount(() => {
  clearInterval(clock)
  clearTimeout(reactionTimer)
  document.removeEventListener('visibilitychange', refreshClock)
  window.removeEventListener('hashchange', navigation.read)
  window.removeEventListener('popstate', navigation.read)
  unsubscribeNavigation?.()
  unsubscribeCatalog?.()
})
function resetReaction(): void {
  reactionActive.value = false
  celebration.value = ''
  character.react(settings.paused ? 'paused' : 'welcome', journey.value.done)
}

function showReaction(event: CharacterReactionEvent, message = '', showFace = true): void {
  clearTimeout(reactionTimer)
  character.react(event, sessions.history.length)
  celebration.value = message
  reactionActive.value = showFace
  reactionTimer = setTimeout(resetReaction, reactionDuration(event))
}

watch([() => journey.value.stage, todayDone, () => streak.value.current, () => sessions.lastSession?.id],
  ([stage, done, days, lastId], [oldStage, oldDone, oldDays, oldId]) => {
    if (stage > oldStage) {
      showReaction('stage-up', `Новая форма: ${CHARACTER_STAGE_LABELS[stage]}`)
    } else if (done > oldDone) {
      if (days > oldDays && days > 1) showReaction('streak', `Дней подряд: ${days}. Продолжаем!`)
      else showReaction(done === 1 ? 'first-done' : 'done', done === 1
        ? 'Первая разминка сегодня. Начало положено!' : 'Ещё один перерыв в пользу себя.')
    } else if (lastId !== oldId) {
      const status = sessions.lastSession?.status
      if (status === 'skipped' || status === 'snoozed') showReaction(status, '', false)
    }
  }
)
watch(() => settings.paused, () => {
  clearTimeout(reactionTimer)
  resetReaction()
})
async function triggerReminder(): Promise<void> {
  actionError.value = ''
  try { await window.api.openPopup() }
  catch (cause) { console.warn('[dashboard] start failed', cause); actionError.value = 'Не удалось открыть разминку. Попробуйте ещё раз.' }
}
function startRecommendation(): void {
  if (exerciseStart.recommendation) void exerciseStart.start({ source: 'recommendation', token: exerciseStart.recommendation.token })
}
</script>

<template>
  <div class="dashboard-app">
    <header class="dashboard-header"><p class="brand-label">BODY DEBUGGER <span class="ml-2 text-slate-400">/ ПЕРЕРЫВ В ПОЛЬЗУ СЕБЯ</span></p><button type="button" class="setting-chip" :aria-pressed="settings.paused" @click="settings.togglePause()">{{ settings.paused ? 'Продолжить' : 'Пауза' }}</button></header>
    <div class="dashboard-layout">
      <aside class="dashboard-navigation">
        <nav aria-label="Разделы приложения"><button v-for="item in tabs" :key="item.id" type="button" :aria-current="tab === item.id ? 'page' : undefined" @click="navigation.navigate(item.id)">{{ item.label }}</button></nav>
        <button type="button" class="dashboard-settings-link" :aria-current="tab === 'settings' ? 'page' : undefined" @click="navigation.navigate('settings')">Настройки</button>
      </aside>
      <main class="dashboard-content space-y-5" :class="{ 'dashboard-content--laboratory': laboratoryActive }">
        <template v-if="tab === 'today'">
          <p class="brand-label text-slate-400">{{ dateLabel }}</p>
          <div v-if="celebration" class="achievement-banner" role="status" aria-live="polite">✦ {{ celebration }}</div>
          <section class="today-hero" data-testid="today-hero">
            <div class="hero-copy space-y-4">
              <p class="text-sm text-emerald-400">Разминка для тебя сейчас</p>
              <template v-if="exerciseStart.recommendation">
                <h1 class="text-3xl font-semibold text-white">{{ exerciseStart.recommendation.exercise.title }}</h1>
                <p class="text-sm text-slate-300">{{ exerciseStart.recommendation.exercise.durationSec }} секунд · одно упражнение</p>
                <p class="max-w-lg text-sm leading-relaxed text-slate-300">{{ exerciseStart.recommendation.exercise.description }}</p>
              </template>
              <h1 v-else class="text-2xl font-semibold text-white">Короткий перерыв в пользу себя</h1>
              <div class="flex flex-wrap gap-3"><button type="button" class="primary-action" :disabled="exerciseStart.busy || !exerciseStart.recommendation" @click="startRecommendation">Размяться сейчас ↗</button><button type="button" class="setting-chip" @click="navigation.navigate('exercises', 'library', { exerciseId: exerciseStart.recommendation?.exercise.id })">Как выполнять</button><button type="button" class="setting-chip" @click="navigation.navigate('exercises')">Выбрать другое</button></div>
              <p class="text-sm text-slate-400">Автоматическое напоминание: {{ reminder.nextTriggerLabel }}</p>
              <p v-if="exerciseStart.error" role="alert" class="text-sm text-red-300">{{ exerciseStart.error }} <button type="button" class="underline" @click="exerciseStart.refresh">Обновить</button></p>
            </div>
            <div class="hero-character" :class="{ 'hero-character--speaking': reactionActive }" :data-idle="!reactionActive" data-testid="character-scene">
              <ComicBubble class="hero-speech" :animation-id="character.reaction.animationId" :variant="character.reaction.variant" :decoration="character.reaction.decoration" :caption="character.reaction.caption" :tone="character.reaction.tone" />
              <CharacterPortrait :pack-id="settings.characterPackId" :reaction-id="character.reaction.animationId" size="xl" :variant="reactionActive ? 'face' : 'body'" :show-label="false" :stage="character.state.stage" :branch="character.state.branch" :build="character.state.build" :emotion="character.emotion" :condition="character.condition.level" />
              <button type="button" class="setting-chip" @click="navigation.navigate('character')">Мой персонаж →</button>
            </div>
          </section>
          <section class="grid grid-cols-2 gap-3" aria-label="Твой прогресс"><div class="metric-card" data-testid="today-count"><p>Разминок сегодня</p><strong>{{ todayDone }}</strong></div><div class="metric-card" data-testid="current-streak"><p>Дней подряд</p><strong>{{ streak.current }}</strong><span>Рекорд: {{ Math.max(streak.max, progress.streak.max) }}</span></div></section>
          <section class="settings-card"><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-sm font-semibold">Следующие перерывы</h2><button type="button" class="setting-chip" @click="navigation.navigate('exercises', 'queue')">Изменить план →</button></div><p class="mt-3 text-sm text-slate-400" data-testid="queue-plan-hint">{{ breakQueue.summary || 'Автоподбор под твой профиль' }}</p></section>
          <details v-if="settings.weight.enabled"><summary class="setting-chip">Записать вес</summary><WeightCard compact /></details>
        </template>
        <ExercisesPanel v-else-if="tab === 'exercises'" />
        <template v-else-if="tab === 'character'">
          <h1 class="text-2xl font-semibold text-white">Мой персонаж</h1>
          <SectionTabs v-model="characterSection" :items="[{ id: 'appearance', label: 'Образ' }, { id: 'development', label: 'Развитие' }, { id: 'chronicle', label: 'Хроника' }]" label="Персонаж и его история">
            <CharacterSettingsPanel v-if="characterSection === 'appearance'" />
            <template v-else-if="characterSection === 'development'"><p class="text-sm text-slate-300">Форма: {{ CHARACTER_STAGE_LABELS[character.state.stage] }} · {{ CHARACTER_BRANCH_LABELS[character.state.branch] }}</p><p class="text-sm text-slate-400" data-testid="character-condition">Текущее состояние: {{ character.conditionLabel }}. Достигнутая форма сохраняется.</p><CharacterJourney /></template>
            <CharacterChronicle v-else :now="now" :context="chronicleContext" @start="triggerReminder" />
          </SectionTabs>
          <p v-if="actionError" role="alert" class="text-sm text-red-300">{{ actionError }}</p>
        </template>
        <ProgressPanel v-else-if="tab === 'progress'" :now="now" :initial-section="section as 'calendar' | 'stats' | 'weight' | 'photos'" @section="navigation.navigate('progress', $event)" @ai="navigation.navigate('exercises', 'ai', { task: 'tune' })" @settings="navigation.navigate('settings', 'comfort')" />
        <SettingsPanel v-else />
        <LaboratoryHost v-show="laboratoryActive" :active="laboratoryActive" />
      </main>
    </div>
  </div>
</template>
