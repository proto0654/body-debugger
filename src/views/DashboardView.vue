<script setup lang="ts">
import { nowDate } from '@shared/domain/clock'
import { useRuntimeStore } from '@/stores/runtime'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DebugPanel from '@/debug/DebugPanel.vue'
import { isDebugEnabled } from '@/debug/is-debug-enabled'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import WeightCard from '@/components/weight/WeightCard.vue'
import CalendarHeatmap from '@/components/stats/CalendarHeatmap.vue'
import StatsPanel from '@/components/stats/StatsPanel.vue'
import PhotoGallery from '@/components/photos/PhotoGallery.vue'
import PreferencesPanel from '@/components/settings/PreferencesPanel.vue'
import ComfortSettingsPanel from '@/components/settings/ComfortSettingsPanel.vue'
import { usePhotosStore } from '@/stores/photos'
import { useProgressStore } from '@/stores/progress'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { useReminderStore } from '@/stores/reminder'
import { useSessionsStore } from '@/stores/sessions'
import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { mergeCatalogs } from '@shared/domain/ai-proposal'
import { characterJourney } from '@shared/domain/character-progress'
import { CHARACTER_CONDITION_MAX_POINTS, CHARACTER_CONDITION_RECOVERY_POINTS } from '@shared/domain/character-condition'
import type { CharacterReactionEvent } from '@shared/domain/character-reaction'
import { computeStreak } from '@shared/domain/streak'
import { localDateKey } from '@shared/domain/stats'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import type { CharacterStage } from '@shared/types/character'

type TabId = 'today' | 'calendar' | 'stats' | 'settings' | 'debug'
const debugEnabled = isDebugEnabled() || !!useRuntimeStore().laboratory
function initialTab(): TabId {
  const requested = /[?&]tab=([a-z]+)/.exec(window.location.hash)?.[1]
  if (requested === 'calendar' || requested === 'stats' || requested === 'settings') return requested
  if (requested === 'debug' && debugEnabled) return 'debug'
  return 'today'
}
const tab = ref<TabId>(initialTab())
const progress = useProgressStore()
const character = useCharacterStore()
const settings = useSettingsStore()
const reminder = useReminderStore()
const sessions = useSessionsStore()
const photos = usePhotosStore()
const customExercises = useCustomExercisesStore()
const runtime = useRuntimeStore()
const now = ref(nowDate())
const celebration = ref('')
const reactionActive = ref(false)
const actionError = ref('')
let clock: ReturnType<typeof setInterval> | undefined
let reactionTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribeNavigation: (() => void) | undefined
const statsCatalog = computed(() => mergeCatalogs(EXERCISE_CATALOG, customExercises.entries))
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
const stages: CharacterStage[] = [0, 1, 2, 3, 4, 5]
const tabs = computed<{ id: TabId; label: string }[]>(() => [
  { id: 'today', label: 'Сегодня' }, { id: 'calendar', label: 'Календарь' },
  { id: 'stats', label: 'Статистика' }, { id: 'settings', label: 'Настройки' },
  ...(debugEnabled ? [{ id: 'debug' as const, label: 'Лаборатория' }] : [])
])
const dateLabel = computed(() => now.value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }))

function refreshClock(): void { now.value = nowDate() }
watch(() => runtime.revision, refreshClock, { flush: 'sync' })
onMounted(() => {
  resetReaction()
  clock = setInterval(refreshClock, 30_000)
  document.addEventListener('visibilitychange', refreshClock)
  unsubscribeNavigation = window.api?.onNavigateDashboard?.(() => { tab.value = 'settings' })
})
onBeforeUnmount(() => {
  clearInterval(clock)
  clearTimeout(reactionTimer)
  document.removeEventListener('visibilitychange', refreshClock)
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
  reactionTimer = setTimeout(resetReaction, showFace ? 3500 : 2500)
}

watch([() => journey.value.stage, todayDone, () => streak.value.current, () => sessions.lastSession?.id],
  ([stage, done, days, lastId], [oldStage, oldDone, oldDays, oldId]) => {
    if (runtime.laboratory?.silent) {
      clearTimeout(reactionTimer)
      resetReaction()
      return
    }
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
  <div class="dashboard-shell mx-auto flex min-h-full max-w-4xl flex-col gap-5 p-6">
    <header class="flex items-center justify-between gap-4">
      <div>
        <p class="brand-label">BODY DEBUGGER <span class="ml-2 text-slate-500">/ ПЕРЕРЫВ В ПОЛЬЗУ СЕБЯ</span></p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-white">Твой рабочий ритм</h1>
      </div>
      <button type="button" class="setting-chip" :aria-pressed="settings.paused" @click="settings.togglePause()">
        {{ settings.paused ? 'Продолжить' : 'Пауза' }}
      </button>
    </header>
    <p v-if="runtime.laboratory" class="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200" data-testid="lab-banner">ЛАБОРАТОРИЯ · Тестовый профиль · {{ dateLabel }}. Обычная история изолирована.</p>
    <nav class="dashboard-tabs" aria-label="Разделы приложения">
      <button v-for="item in tabs" :key="item.id" type="button" :aria-pressed="tab === item.id"
        :class="{ 'is-active': tab === item.id }" @click="tab = item.id">{{ item.label }}</button>
    </nav>

    <template v-if="tab === 'today'">
      <div v-if="celebration" class="achievement-banner" role="status" aria-live="polite">✦ {{ celebration }}</div>
      <section class="today-hero" data-testid="today-hero">
        <div class="hero-copy">
          <p class="brand-label text-slate-400">{{ dateLabel }}</p>
          <ComicBubble :key="character.reaction.caption" class="hero-speech" heading tail="right"
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
        <div class="hero-character" :class="{ 'hero-character--speaking': reactionActive }" data-testid="character-scene">
          <span class="character-badge">ФОРМА {{ character.state.stage + 1 }} / 6</span>
          <CharacterPortrait :pack-id="settings.characterPackId" size="xl" :variant="reactionActive ? 'face' : 'body'" :show-label="false" :stage="character.state.stage" :branch="character.state.branch"
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
      <section class="settings-card space-y-4" data-testid="character-journey">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div><p class="brand-label text-slate-500">ТВОЯ ЭВОЛЮЦИЯ</p>
            <h2 class="mt-1 text-sm font-semibold text-white">{{ journey.nextStage === null ? 'Пиковая форма достигнута' : `Следующая форма: ${CHARACTER_STAGE_LABELS[journey.nextStage]}` }}</h2>
          </div>
          <p class="text-xs text-emerald-400">{{ journey.nextStage === null ? 'Продолжай в своём ритме' : remainingLabel }}</p>
        </div>
        <div class="journey-track" role="progressbar" aria-label="До следующей формы" :aria-valuenow="Math.round(journey.ratio * 100)" aria-valuemin="0" aria-valuemax="100">
          <div :style="{ width: `${journey.ratio * 100}%` }"></div>
        </div>
        <ol class="journey-stages">
          <li v-for="stage in stages" :key="stage" :class="{ reached: stage <= journey.stage, current: stage === journey.stage }" :aria-current="stage === journey.stage ? 'step' : undefined">
            <span>{{ stage + 1 }}</span><p>{{ CHARACTER_STAGE_LABELS[stage] }}</p>
          </li>
        </ol>
      </section>
      <WeightCard v-if="settings.weight.enabled" />
      <section v-if="settings.photos.enabled" class="settings-card space-y-3">
        <h2 class="text-sm font-semibold text-white">Фото прогресса</h2>
        <PhotoGallery :photos="photos.entries" @remove="photos.remove" />
      </section>
      <p class="text-center text-xs text-slate-500">Всё хранится на твоём компьютере. <button class="text-slate-400 hover:text-white" type="button" @click="tab = 'settings'">Настроить под себя →</button></p>
    </template>
    <section v-else-if="tab === 'calendar'" class="settings-card space-y-4">
      <h2 class="text-sm font-semibold text-white">Активность за 13 недель</h2>
      <CalendarHeatmap :sessions="sessions.history" :catalog="statsCatalog" :now="now" />
    </section>
    <section v-else-if="tab === 'stats'" class="settings-card space-y-4">
      <h2 class="text-sm font-semibold text-white">Твоя статистика</h2>
      <StatsPanel :sessions="sessions.history" :catalog="statsCatalog" :now="now" />
    </section>
    <template v-else-if="tab === 'settings'"><PreferencesPanel /><ComfortSettingsPanel /></template>
    <DebugPanel v-else />
  </div>
</template>
