<script setup lang="ts">
import { nowDate } from '@shared/domain/clock'
import { useRuntimeStore } from '@/stores/runtime'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterSettingsPanel from '@/components/character/CharacterSettingsPanel.vue'
import CharacterJourney from '@/components/character/CharacterJourney.vue'
import CharacterChronicle from '@/components/character/CharacterChronicle.vue'
import ManualCharacterControls from '@/components/character/ManualCharacterControls.vue'
import LaboratoryHost from '@/debug/LaboratoryHost.vue'
import SectionTabs from '@/components/SectionTabs.vue'
import { defaultManualState, type ManualCharacterState } from '@shared/domain/character-context'
import ProgressPanel from '@/components/stats/ProgressPanel.vue'
import { reactionDuration } from '@shared/domain/reaction-timing'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import WeightCard from '@/components/weight/WeightCard.vue'
import PreferencesPanel from '@/components/settings/PreferencesPanel.vue'
import ComfortSettingsPanel from '@/components/settings/ComfortSettingsPanel.vue'
import SystemPanel from '@/components/settings/SystemPanel.vue'
import AboutPanel from '@/components/settings/AboutPanel.vue'
import { useProgressStore } from '@/stores/progress'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { useReminderStore } from '@/stores/reminder'
import { useSessionsStore } from '@/stores/sessions'
import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { characterJourney } from '@shared/domain/character-progress'
import { CHARACTER_CONDITION_MAX_POINTS, CHARACTER_CONDITION_RECOVERY_POINTS } from '@shared/domain/character-condition'
import type { CharacterReactionEvent } from '@shared/domain/character-reaction'
import { computeStreak } from '@shared/domain/streak'
import { localDateKey } from '@shared/domain/stats'
import type { CharacterContext } from '@shared/domain/character-context'

type TabId = 'today' | 'character' | 'laboratory' | 'progress' | 'settings'
type ProgressSection = 'calendar' | 'stats' | 'weight' | 'photos'
type CharacterSection = 'profile' | 'chronicle'
const requestedTab = () => /[?&]tab=([a-z]+)/.exec(window.location.hash)?.[1]
const progressSection = ref<ProgressSection>(requestedTab() === 'stats' ? 'stats' : 'calendar')
const characterSection = ref<CharacterSection>('profile')
const runtime = useRuntimeStore()
function initialTab(): TabId {
  const requested = requestedTab()
  if (requested === 'calendar' || requested === 'stats') return 'progress'
  if (requested === 'settings' || requested === 'character' || requested === 'progress') return requested
  if (requested === 'laboratory' || requested === 'playground') return 'laboratory'
  return 'today'
}
const tab = ref<TabId>(initialTab())
const progress = useProgressStore()
const character = useCharacterStore()
const settings = useSettingsStore()
const reminder = useReminderStore()
const sessions = useSessionsStore()
const now = ref(nowDate())
const chronicleManual = ref<ManualCharacterState | null>(null)
const chronicleContext = computed<CharacterContext>(() => ({
  id: 'main',
  title: 'Основной персонаж',
  sessions: sessions.history,
  packId: settings.characterPackId,
  build: progress.characterBuild,
  allowStart: true,
  manual: chronicleManual.value
}))
const chronicleDefaults = computed(() => defaultManualState(chronicleContext.value, now.value))
const celebration = ref('')
const reactionActive = ref(false)
const actionError = ref('')
let clock: ReturnType<typeof setInterval> | undefined
let reactionTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribeNavigation: (() => void) | undefined
const journey = computed(() => characterJourney(sessions.history))
const remainingLabel = computed(() => {
  const count = journey.value.remaining
  const plural = new Intl.PluralRules('ru-RU').select(count)
  const word = plural === 'one' ? 'разминка' : plural === 'few' ? 'разминки' : 'разминок'
  return `Ещё ${count} ${word}`
})
const streak = computed(() => computeStreak(sessions.history, now.value))
const todayDone = computed(() => sessions.history.filter(session =>
  session.status === 'done' && localDateKey(new Date(session.completedAt ?? session.triggeredAt)) === localDateKey(now.value)
).length)
const tabs = computed<{ id: TabId; label: string }[]>(() => [
  { id: 'today', label: 'Сегодня' }, { id: 'character', label: 'Персонаж' },
  { id: 'laboratory', label: 'Лаборатория' },
  { id: 'progress', label: 'Прогресс' }, { id: 'settings', label: 'Настройки' }
])
const dateLabel = computed(() => now.value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }))

function refreshClock(): void { now.value = nowDate() }
function navigateFromHash(): void {
  tab.value = initialTab()
  if (requestedTab() === 'calendar' || requestedTab() === 'stats') progressSection.value = requestedTab() as ProgressSection
}
watch(() => runtime.revision, refreshClock, { flush: 'sync' })
onMounted(() => {
  resetReaction()
  clock = setInterval(refreshClock, 30_000)
  document.addEventListener('visibilitychange', refreshClock)
  window.addEventListener('hashchange', navigateFromHash)
  unsubscribeNavigation = window.api?.onNavigateDashboard?.((payload) => {
    tab.value = payload.tab
  })
})
onBeforeUnmount(() => {
  clearInterval(clock)
  clearTimeout(reactionTimer)
  document.removeEventListener('visibilitychange', refreshClock)
  window.removeEventListener('hashchange', navigateFromHash)
  unsubscribeNavigation?.()
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
  try { await window.api?.openPopup() }
  catch (cause) {
    console.error('[dashboard] failed to open exercise', cause)
    actionError.value = 'Не удалось открыть разминку. Попробуйте ещё раз.'
  }
}
</script>

<template>
  <div class="dashboard-shell mx-auto flex min-h-full flex-col gap-5 p-6" :class="tab === 'laboratory' ? 'max-w-6xl' : 'max-w-4xl'">
    <header class="flex items-center justify-between gap-4">
      <div>
        <p class="brand-label">BODY DEBUGGER <span class="ml-2 text-slate-500">/ ПЕРЕРЫВ В ПОЛЬЗУ СЕБЯ</span></p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-white">Твой рабочий ритм</h1>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
      <button type="button" class="setting-chip" :aria-pressed="settings.paused" @click="settings.togglePause()">
        {{ settings.paused ? 'Продолжить' : 'Пауза' }}
      </button>
      </div>
    </header>
    <nav class="dashboard-tabs" aria-label="Разделы приложения">
      <button v-for="item in tabs" :key="item.id" type="button" :aria-current="tab === item.id ? 'page' : undefined"
        :class="{ 'is-active': tab === item.id }" @click="tab = item.id">{{ item.label }}</button>
    </nav>

    <template v-if="tab === 'today'">
      <div v-if="celebration" class="achievement-banner" role="status" aria-live="polite">✦ {{ celebration }}</div>
      <section class="today-hero" data-testid="today-hero">
        <div class="hero-copy">
          <p class="brand-label text-slate-400">{{ dateLabel }}</p>
          <ComicBubble :animation-id="character.reaction.animationId" :variant="character.reaction.variant" :decoration="character.reaction.decoration" class="hero-speech" heading tail="right"
            :caption="character.reaction.caption" :tone="character.reaction.tone" />
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {{ journey.done === 0 ? 'Одна короткая разминка — уже начало. Твой герой растёт с каждым выполнением.' : 'Маленькие перерывы складываются в привычку. Твой герой растёт вместе с тобой.' }}
          </p>
          <div class="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" class="primary-action" @click="triggerReminder">Размяться сейчас <span aria-hidden="true">↗</span></button>
            <span class="text-xs text-slate-500">Одно упражнение за раз</span>
          </div>
          <p class="mt-4 text-xs" :class="reminder.paused ? 'text-amber-400' : 'text-slate-400'">{{ reminder.nextTriggerLabel }}</p>
          <p class="mt-3 text-xs text-emerald-400">{{ journey.nextStage === null ? 'Пиковая форма достигнута' : `${remainingLabel} до формы «${CHARACTER_STAGE_LABELS[journey.nextStage]}»` }}</p>
          <div v-if="character.condition.points > 0" class="mt-4 max-w-sm rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-relaxed" data-testid="character-condition" role="status">
            <p class="font-semibold text-amber-300">{{ character.conditionLabel }} · {{ character.condition.points }} / {{ CHARACTER_CONDITION_MAX_POINTS }}</p>
            <p class="mt-1 text-slate-400">Пропуски ухудшают внешний вид. Разминка снимает {{ CHARACTER_CONDITION_RECOVERY_POINTS }} очка. До полного восстановления: {{ character.condition.recoverySessions }}.</p>
            <p class="mt-1 text-slate-500">Достигнутая форма сохраняется.</p>
          </div>
          <p v-if="actionError" class="mt-2 text-xs text-red-300" role="alert">{{ actionError }}</p>
        </div>
        <div class="hero-character" :class="{ 'hero-character--speaking': reactionActive }" :data-idle="!reactionActive" data-testid="character-scene">
          <span class="character-badge">ФОРМА {{ character.state.stage + 1 }} / 6</span>
          <CharacterPortrait :pack-id="settings.characterPackId" :reaction-id="character.reaction.animationId" size="xl" :variant="reactionActive ? 'face' : 'body'" :show-label="false" :stage="character.state.stage" :branch="character.state.branch"
            :build="character.state.build" :emotion="character.emotion" :condition="character.condition.level" />
          <p class="mt-1 text-lg font-semibold text-white">{{ CHARACTER_STAGE_LABELS[character.state.stage] }}</p>
          <p class="mt-1 text-xs text-emerald-400">{{ CHARACTER_BRANCH_LABELS[character.state.branch] }}</p>
        </div>
      </section>
      <section class="grid grid-cols-3 gap-3" aria-label="Твой прогресс">
        <div class="metric-card" data-testid="today-count"><p>Разминок сегодня</p><strong>{{ todayDone }}</strong><span>{{ todayDone ? 'Хороший рабочий ритм' : 'Начни с одной' }}</span></div>
        <div class="metric-card" data-testid="current-streak"><p>Дней подряд</p><strong>{{ streak.current }}</strong><span>Рекорд: {{ Math.max(streak.max, progress.streak.max) }}</span></div>
        <div class="metric-card"><p>Разминок всего</p><strong>{{ journey.done }}</strong><span>Каждая идёт в зачёт</span></div>
      </section>
      <CharacterJourney compact />
      <WeightCard v-if="settings.weight.enabled" compact />
      <p class="text-center text-xs text-slate-500">Всё хранится на твоём компьютере. <button class="text-slate-400 hover:text-white" type="button" @click="tab = 'settings'">Настроить под себя →</button></p>
    </template>
    <div v-if="tab === 'character'" class="space-y-4">
      <SectionTabs v-model="characterSection" :items="[{ id: 'profile', label: 'Профиль' }, { id: 'chronicle', label: 'Хроника' }]" label="Персонаж и его история">
        <template v-if="characterSection === 'profile'"><CharacterSettingsPanel /><CharacterJourney /></template>
        <template v-else>
          <ManualCharacterControls v-model="chronicleManual" :defaults="chronicleDefaults" :pack-id="chronicleContext.packId" />
          <CharacterChronicle :now="now" :context="chronicleContext" @start="triggerReminder" />
        </template>
      </SectionTabs>
    </div>
    <LaboratoryHost v-show="tab === 'laboratory'" :active="tab === 'laboratory'" />
    <ProgressPanel v-if="tab === 'progress'" :now="now" :initial-section="progressSection" @settings="tab = 'settings'" />
    <template v-if="tab === 'settings'"><PreferencesPanel /><ComfortSettingsPanel group="presentation" /><SystemPanel /><AboutPanel /></template>
  </div>
</template>
