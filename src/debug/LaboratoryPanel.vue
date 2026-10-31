<script setup lang="ts">
import CharacterSettingsPanel from '@/components/character/CharacterSettingsPanel.vue'
import SectionTabs from '@/components/SectionTabs.vue'
import PreferencesPanel from '@/components/settings/PreferencesPanel.vue'
import ComfortSettingsPanel from '@/components/settings/ComfortSettingsPanel.vue'
import WeightCard from '@/components/weight/WeightCard.vue'
import PhotoGallery from '@/components/photos/PhotoGallery.vue'
import { usePhotosStore } from '@/stores/photos'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { mergeCatalogs } from '@shared/domain/ai-proposal'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import CalendarHeatmap from '@/components/stats/CalendarHeatmap.vue'
import StatsPanel from '@/components/stats/StatsPanel.vue'
import AppearancePanel from './AppearancePanel.vue'
import ProgressDynamics from '@/components/character/ProgressDynamics.vue'
import SoundAuditionPanel from './SoundAuditionPanel.vue'
import { LAB_PHASE_LABELS } from '@shared/domain/laboratory-playback'
import { resolveFrameUrl } from '@/components/character/frames'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { useRuntimeStore } from '@/stores/runtime'
import { applySnapshot } from '@/bootstrap/hydrate'
import { LAB_SCENARIOS, labEventExplanation, labMilestones, labSummary, type LabCommand, type LabGeneratorOptions, type LabState } from '@shared/domain/laboratory'
import { nowDate } from '@shared/domain/clock'
import { localDateKey } from '@shared/domain/stats'
import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { SOUND_CUES, SOUND_CUE_LABELS, type SoundCue } from '@shared/domain/sounds'
import { characterJourney } from '@shared/domain/character-progress'
import { computeStreak } from '@shared/domain/streak'
import { createSoundPlayer } from '@/sounds'
import { characterReaction } from '@shared/domain/character-reaction'
import type { LabVisualPreview } from '@shared/domain/laboratory-preview'

const state = ref<LabState | null>(null)
type LabTab = 'history' | 'popup' | 'appearance' | 'sound' | 'data' | 'settings'
const tab = ref<LabTab>('history')
const manualVisual = ref<LabVisualPreview | null>(null)
const inspecting = computed(() => tab.value === 'appearance' && manualVisual.value !== null)
const tabs: { id: LabTab; label: string }[] = [
  { id: 'history', label: 'Сценарии' }, { id: 'popup', label: 'Попап и цикл' },
  { id: 'appearance', label: 'Ручная проверка' }, { id: 'sound', label: 'Звуки' },
  { id: 'data', label: 'Данные' }, { id: 'settings', label: 'Настройки' }
]
const photos = usePhotosStore()
const customExercises = useCustomExercisesStore()
const exerciseId = ref('')
const catalog = computed(() => mergeCatalogs(EXERCISE_CATALOG, customExercises.entries))
const busy = ref(false)
const error = ref('')
const speed = ref(1500)
const stepUnit = ref<'event' | 'day' | 'milestone'>('event')
const jumpSeconds = ref(60)
const tick = ref(0)
const character = useCharacterStore()
const sceneCharacter = computed(() => inspecting.value ? manualVisual.value! : { ...character.state, condition: character.condition.level })
const sceneReaction = computed(() => inspecting.value ? characterReaction(manualVisual.value!.popup === 'error' ? 'active' : manualVisual.value!.popup, manualVisual.value!.sequence) : character.reaction)
const progress = useProgressStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()
const runtime = useRuntimeStore()
const preview = createSoundPlayer({ createAudio: src => new Audio(src),
  getSettings: () => ({ ...settings.sound, enabled: true, volume: Math.max(0.1, settings.sound.volume) }), isPaused: () => false })
const generator = ref<LabGeneratorOptions>({ days: 30, activity: 'uneven', load: 'normal', direction: 'neutral', seed: 4242, endDate: localDateKey(new Date()) })
let unsubscribe: (() => void) | undefined
let clock: ReturnType<typeof setInterval> | undefined
let reactionTimer: ReturnType<typeof setTimeout> | undefined
const showFace = ref(false)
const frameStatus = ref('')
function describeFrame(status: { fallback: boolean; failed: number; url?: string }): void {
  frameStatus.value = status.fallback
    ? `Запасной кадр: ${status.url ? 'тот же персонаж' : 'эмодзи'}; ошибок загрузки: ${status.failed}`
    : 'Основной кадр найден'
}
const now = computed(() => { tick.value; runtime.revision; return nowDate() })
const plan = computed(() => state.value?.plan)
const milestones = computed(() => plan.value ? labMilestones(plan.value) : [])
const expected = computed(() => plan.value ? labSummary(plan.value, state.value?.cursor ?? 0) : null)
const journey = computed(() => characterJourney(sessions.history))
const streak = computed(() => computeStreak(sessions.history, now.value))
const phaseLabel = computed(() => LAB_PHASE_LABELS[state.value?.playback?.phase ?? 'idle'])
const liveCaption = computed(() => inspecting.value ? sceneReaction.value.caption : !runtime.laboratory?.silent && state.value?.playback?.sessionId
  ? character.reaction.caption : 'СМОТРИМ, КАК МЕНЯЕТСЯ ФОРМА')
const current = computed(() => plan.value?.events[state.value?.cursor ?? 0])
const explanation = computed(() => plan.value ? labEventExplanation(plan.value, state.value?.cursor ?? 0) : '')
const events = computed(() => {
  const cursor = state.value?.cursor ?? 0
  const start = Math.max(0, cursor - 4)
  return plan.value?.events.slice(start, start + 12).map((event, index) => ({ ...event, index: start + index })) ?? []
})
const positionDate = computed(() => localDateKey(now.value))
const dateLabel = computed(() => now.value.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'medium' }))
const actualMatches = computed(() => !state.value?.detached && expected.value
  ? expected.value.character.stage === progress.characterStage && expected.value.character.branch === progress.characterBranch
    && expected.value.condition.points === character.condition.points && expected.value.streak.current === streak.value.current : null)

async function command(value: LabCommand): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { state.value = await window.api.labCommand(value) }
  catch (cause) {
    console.error('[laboratory] command failed', value.action, cause)
    const detail = cause instanceof Error ? cause.message : ''
    error.value = detail.includes('too large') ? 'Файл слишком большой. Максимум — 2 МБ.'
      : detail.includes('version') || detail.includes('Invalid laboratory file') ? 'Неподдерживаемый или повреждённый формат сценария.'
      : detail.includes('character') ? 'В сценарии указан неизвестный персонаж.'
      : detail.includes('action sequence') ? 'Неверный порядок действий в сценарии.'
      : detail.includes('laboratory session') ? 'Сценарий содержит неизвестное упражнение или неверную сессию.'
      : 'Действие не выполнено. Проверьте параметры; для восстановления сначала сохраните вариант.'
  } finally { busy.value = false }
}

async function changeSetting(action: () => Promise<void>): Promise<void> {
  error.value = ''
  try { await action() }
  catch (cause) {
    console.error('[laboratory] setting failed', cause)
    error.value = 'Не удалось сохранить тестовую настройку.'
  }
}

function newCalendar(): void {
  generator.value.seed = Math.floor(Math.random() * 0x100000000)
  void command({ action: 'generate', options: { ...generator.value } })
}
function seek(value: number): void { void command({ action: 'seek', cursor: value }) }
function playCue(cue: SoundCue): void { preview.play(cue) }
function milestoneLabel(index: number): string {
  if (!plan.value) return ''
  const summary = labSummary(plan.value, index)
  return `${new Date(plan.value.events[index]!.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · форма ${summary.character.stage} · спад ${summary.condition.level} · ${labEventExplanation(plan.value, index)}`
}

watch([() => journey.value.stage, () => sessions.lastSession?.id], ([stage], [oldStage]) => {
  clearTimeout(reactionTimer)
  showFace.value = false
  if (runtime.laboratory?.silent || (!state.value?.playing && !state.value?.playback?.sessionId)) return
  const last = sessions.lastSession
  if (!last) return
  const stageUp = stage > oldStage
  character.react(stageUp ? 'stage-up' : last.status === 'done' ? 'done' : last.status === 'snoozed' ? 'snoozed' : 'skipped', sessions.history.length)
  showFace.value = last.status === 'done'
  reactionTimer = setTimeout(() => { showFace.value = false }, 3500)
})
watch(() => runtime.laboratory?.silent, silent => {
  if (silent) { clearTimeout(reactionTimer); showFace.value = false; character.react('welcome', sessions.history.length) }
})
watch(() => state.value?.playback?.phase, phase => {
  if (runtime.laboratory?.silent) return
  if (phase === 'reminder') character.react('ready', sessions.history.length)
  if (phase === 'exercise') character.react('active', sessions.history.length)
})
watch(() => state.value?.plan?.generator, options => {
  if (options) generator.value = { ...options }
})

onMounted(async () => {
  try {
    unsubscribe = window.api.onLabChanged(next => {
      if (next.snapshot) applySnapshot(next.snapshot)
      state.value = next
    })
    state.value = await window.api.getLabState()
    clock = setInterval(() => { tick.value++ }, 1000)
  } catch (cause) {
    console.error('[laboratory] initialization failed', cause)
    error.value = 'Лаборатория недоступна в этом экземпляре приложения.'
  }
})
onBeforeUnmount(() => { unsubscribe?.(); clearInterval(clock); clearTimeout(reactionTimer) })
</script>

<template>
  <div class="laboratory space-y-5" data-testid="laboratory-panel">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><p class="brand-label text-amber-300">BODY DEBUGGER / LAB</p><h1 class="mt-2 text-2xl font-semibold text-white">Лаборатория</h1></div>
    </header>
    <div class="lab-status"><span class="lab-dot" />Тестовый профиль · {{ dateLabel }}<span class="ml-auto">{{ runtime.laboratory?.running ? 'Время идёт' : 'Время остановлено' }}</span></div>
      <section class="lab-transport settings-card" data-testid="lab-console">
        <div class="lab-controls">
          <label class="min-w-0 flex-1">Сценарий<select aria-label="Сценарий" class="!max-w-none" :value="plan?.id ?? ''" :disabled="busy" @change="command({ action: 'scenario', id: ($event.target as HTMLSelectElement).value as typeof LAB_SCENARIOS[number]['id'] })"><option disabled value="">Выберите историю</option><option v-for="scenario in LAB_SCENARIOS" :key="scenario.id" :value="scenario.id">{{ scenario.title }}</option><option v-if="plan?.generator" :value="plan.id">{{ plan.title }}</option></select></label>
          <label>Режим<select aria-label="Режим проигрывания" :value="state?.playback?.mode ?? 'automatic'" :disabled="busy || !plan" @change="command({ action: 'mode', mode: ($event.target as HTMLSelectElement).value as 'automatic' | 'interactive' })"><option value="automatic">Автоматически</option><option value="interactive">Выбираю сам</option></select></label>
          <label>Темп<select v-model="speed"><option :value="3500">Медленно</option><option :value="1500">Обычно</option><option :value="500">Быстро</option></select></label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="primary-action !px-3 !py-2 !text-xs" data-testid="lab-play" :disabled="busy || !plan" @click="command(state?.playing ? { action: 'pause' } : { action: 'play', delayMs: speed })">{{ state?.playing ? 'Пауза' : state?.playback?.phase === 'error' ? 'Повторить действие' : '▶ Проиграть сценарий' }}</button>
          <button type="button" class="setting-chip" :disabled="busy || !plan" @click="command({ action: 'phase-step' })">Следующий шаг</button>
          <button type="button" class="setting-chip" :disabled="busy || !plan" @click="command({ action: 'restart' })">Сначала</button>
        </div>
        <div class="rounded-lg bg-slate-950 p-2" aria-live="polite"><p class="text-xs font-semibold text-amber-200">{{ phaseLabel }}</p><p class="mt-1 text-[11px] text-slate-400">{{ state?.playback?.action || 'Выберите историю и нажмите «Проиграть сценарий»' }}</p><p class="mt-1 text-[10px] text-slate-500">{{ dateLabel }}</p></div>
        <p v-if="!settings.sound.enabled" data-testid="lab-sound-off" class="flex flex-wrap items-center gap-2 text-xs text-amber-300">Звук выключен в настройках этого профиля — сценарий проигрывается без звука.
          <button type="button" class="setting-chip" :disabled="busy" @click="changeSetting(() => settings.setSoundEnabled(true))">Включить звук</button>
        </p>
        <p v-if="state?.playback?.error" role="alert" class="text-xs text-red-300">{{ state.playback.error }}</p>
        <p v-if="state?.playback?.waiting && state.playback.mode === 'interactive'" class="text-xs text-amber-300">Выберите действие в настоящем попапе у трея.</p>
        <div v-if="state?.hasOriginal" class="flex flex-wrap gap-2"><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'popup', preset: 'normal' })">Продолжить вручную</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'original' })">Вернуться к исходному</button></div>
      </section>
    <div class="lab-workspace">
    <aside class="lab-sidebar space-y-4">
    <div class="lab-console">
      <section class="lab-live settings-card" :data-idle="!inspecting && !showFace && !state?.playing" :data-manual-stage="inspecting ? sceneCharacter.stage : undefined">
        <div class="flex flex-col items-center justify-center gap-3">
          <p v-if="inspecting" class="character-badge">РУЧНОЙ ПРОСМОТР</p>
          <CharacterPortrait @frame-status="describeFrame" :pack-id="sceneCharacter.packId" :stage="sceneCharacter.stage" :branch="sceneCharacter.branch" :build="sceneCharacter.build" :emotion="sceneCharacter.emotion" :reaction-id="sceneReaction.animationId" :condition="sceneCharacter.condition" :variant="!inspecting && showFace ? 'face' : 'body'" size="xl" :show-label="false" />
          <CharacterPortrait v-if="inspecting" :pack-id="sceneCharacter.packId" :stage="sceneCharacter.stage" :branch="sceneCharacter.branch" :build="sceneCharacter.build" :emotion="sceneCharacter.emotion" :reaction-id="sceneReaction.animationId" variant="face" size="sm" :show-label="false" />
          <div class="text-center"><p class="font-semibold text-white">{{ CHARACTER_STAGE_LABELS[sceneCharacter.stage] }}</p><p class="mt-1 text-xs text-emerald-400">{{ CHARACTER_BRANCH_LABELS[sceneCharacter.branch] }}</p></div>
        </div>
        <div class="space-y-4">
          <CharacterSettingsPanel compact :preview="false" />
          <ComicBubble :caption="liveCaption" :tone="sceneReaction.tone" :variant="sceneReaction.variant" :decoration="sceneReaction.decoration" :animation-id="sceneReaction.animationId" />
          <template v-if="!inspecting">
            <div class="grid grid-cols-3 gap-2"><div class="metric-card"><p>Выполнено</p><strong>{{ journey.done }}</strong></div><div class="metric-card"><p>Стрик</p><strong>{{ streak.current }}</strong></div><div class="metric-card"><p>Ухудшение</p><strong>{{ character.condition.points }}<small class="text-sm text-slate-500"> / 10</small></strong></div></div>
            <p class="text-sm text-slate-300">{{ character.conditionLabel }} · уровень {{ character.condition.level }}. До восстановления: {{ character.condition.recoverySessions }} выполнений.</p>
            <p class="text-xs text-slate-400">{{ journey.nextStage === null ? 'Пиковая форма достигнута' : `До следующей формы: ${journey.remaining} выполнений` }}. Рекорд серии: {{ streak.max }}.</p>
          </template>
          <p v-else class="text-xs text-amber-200">Форма {{ sceneCharacter.stage + 1 }} / 6 · состояние {{ sceneCharacter.condition }} / 3. Визуальный просмотр; история не изменена.</p>
          <p v-if="!inspecting && actualMatches !== null" class="text-xs" :class="actualMatches ? 'text-emerald-400' : 'text-red-300'" data-testid="lab-checkpoint">{{ actualMatches ? '✓ Состояние соответствует истории до курсора' : 'Состояние отличается от контрольной точки' }}</p>
          <details v-if="!inspecting" class="text-[11px] text-slate-500"><summary class="cursor-pointer">Диагностика кадра</summary><p class="mt-2 break-all">{{ settings.characterPackId }} · {{ character.visualKey.candidates.join(' → ') }}</p><p class="break-all">{{ resolveFrameUrl(character.visualKey.candidates, settings.characterPackId) ?? 'Кадров нет — эмодзи' }}</p><p>{{ frameStatus }}</p><p>При ошибке загрузки: следующий кадр того же персонажа → эмодзи.</p></details>
        </div>
      </section>
    </div>
    <ProgressDynamics :sessions="sessions.history" :now="now" :start-at="plan?.events[0]?.at" />
    </aside>
    <div class="lab-main min-w-0">
    <SectionTabs v-model="tab" :items="tabs" label="Разделы лаборатории">
    <template v-if="tab === 'history'">
      <details class="settings-card" :open="!plan">
        <summary class="cursor-pointer text-sm font-semibold text-white">{{ plan ? `История: ${plan.title} · выбрать другую` : 'Выберите типовую историю' }}</summary>
      <section class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Типовые истории">
        <button v-for="scenario in LAB_SCENARIOS" :key="scenario.id" class="lab-scenario" :class="{ selected: plan?.id === scenario.id }" type="button" :disabled="busy" :data-lab-scenario="scenario.id" @click="command({ action: 'scenario', id: scenario.id })"><span class="block text-sm font-semibold text-white">{{ scenario.title }}</span><span class="mt-1 block text-xs leading-relaxed text-slate-400">{{ scenario.description }}</span></button>
      </section>
      </details>
      <details class="settings-card" data-testid="lab-generator">
        <summary class="cursor-pointer text-sm font-semibold text-white">Случайный календарь <span class="font-normal text-slate-500">· 7 / 30 / 90 дней · повтор по seed</span></summary>
        <div class="lab-controls mt-4">
          <label>Период<select v-model="generator.days"><option v-for="days in [7, 30, 90]" :key="days" :value="days">{{ days }} дней</option></select></label>
          <label>Ритм<select v-model="generator.activity"><option value="regular">Регулярный</option><option value="uneven">Неровный</option><option value="skips">Частые пропуски</option></select></label>
          <label>Нагрузка<select v-model="generator.load"><option value="low">Низкая</option><option value="normal">Обычная</option><option value="high">Высокая</option></select></label>
          <label>Направление<select v-model="generator.direction"><option v-for="(title, key) in CHARACTER_BRANCH_LABELS" :key="key" :value="key">{{ title }}</option></select></label>
          <label>Последний день<input v-model="generator.endDate" type="date" min="2000-01-01" max="2100-12-31"></label>
          <label>Seed<input v-model.number="generator.seed" type="number" min="0" max="4294967295" step="1"></label>
        </div>
        <div class="mt-3 flex flex-wrap gap-2"><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'generate', options: { ...generator } })">Повторить параметры</button><button type="button" class="setting-chip" :disabled="busy" @click="newCalendar">Создать новый вариант</button></div>
      </details>

      <div v-if="plan && state" class="settings-card space-y-4" data-testid="lab-timeline">
        <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-white">Просмотр даты · {{ plan.title }}</h2><span class="text-xs text-slate-400">{{ state.cursor + 1 }} / {{ plan.events.length }}</span></div>
        <input class="lab-range w-full" aria-label="Позиция на таймлайне" type="range" min="0" :max="plan.events.length - 1" :value="state.cursor" :disabled="busy" @change="seek(Number(($event.target as HTMLInputElement).value))">
        <div class="lab-controls">
          <div class="flex items-center gap-1"><button type="button" class="setting-chip" :disabled="busy" @click="seek(0)">В начало</button><button type="button" aria-label="Шаг назад" class="setting-chip" :disabled="busy" @click="command({ action: 'step', direction: -1, unit: stepUnit })">←</button><button type="button" aria-label="Шаг вперёд" class="setting-chip" :disabled="busy" @click="command({ action: 'step', direction: 1, unit: stepUnit })">→</button><button type="button" class="setting-chip" :disabled="busy" @click="seek(plan.events.length - 1)">В конец</button></div>
          <label>Шаг<select v-model="stepUnit"><option value="event">Событие</option><option value="day">День</option><option value="milestone">Изменение формы / серии</option></select></label>
          <label>Темп<select v-model="speed"><option :value="3500">Медленно · 3,5 с</option><option :value="1500">Обычно · 1,5 с</option><option :value="500">Быстро · 0,5 с</option></select></label>
          <label>Перейти к дате<input type="date" :value="positionDate" :disabled="busy" @change="command({ action: 'date', date: ($event.target as HTMLInputElement).value })"></label>
        </div>
        <p class="text-xs text-slate-500">Просмотр даты восстанавливает историю без попапов и звуков. «Проиграть сценарий» выполняет события в настоящем окне.</p><p class="text-sm text-amber-200">{{ current?.label }}</p>
        <p class="text-xs leading-relaxed text-slate-400">{{ explanation }}</p>
        <p v-if="state.interrupted || state.detached" class="text-xs text-amber-400">Ручная проверка изменила состояние. Переход по таймлайну восстановит выбранную точку.</p>
        <details><summary class="cursor-pointer text-xs text-slate-400">Контрольные точки · {{ milestones.length }}</summary><div class="mt-3 flex flex-wrap gap-2"><button v-for="index in milestones" :key="index" type="button" class="setting-chip" :disabled="busy" @click="seek(index)">{{ milestoneLabel(index) }}</button></div></details>
      </div>

      <section class="settings-card space-y-3"><h2 class="text-sm font-semibold text-white">Календарь до выбранного момента</h2><CalendarHeatmap :sessions="sessions.history" :catalog="catalog" :now="now" /></section>
      <details class="settings-card"><summary class="cursor-pointer text-sm text-white">Статистика и события</summary><div class="mt-4 space-y-5"><StatsPanel :sessions="sessions.history" :catalog="catalog" :now="now" /><ol class="space-y-1"><li v-for="event in events" :key="event.index"><button type="button" class="lab-event" :class="{ current: event.index === state?.cursor, future: event.index > (state?.cursor ?? 0) }" :disabled="busy" @click="seek(event.index)"><span class="w-28 shrink-0 text-slate-500">{{ new Date(event.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>{{ event.label }}</button></li></ol></div></details>
    </template>

    <section v-else-if="tab === 'popup'" class="space-y-4" data-testid="lab-popup">
      <div class="settings-card space-y-3"><h2 class="font-semibold text-white">Настоящий попап у трея</h2><p class="text-xs leading-relaxed text-slate-400">Откройте окно, нажмите «Начать», проверьте таймер и результат. Запись, эмоции и трей проходят через обычный цикл приложения. Любой ручной результат останавливает воспроизведение истории.</p>
        <label class="block space-y-2 text-xs text-slate-300">Упражнение
          <select v-model="exerciseId" class="profile-select" aria-label="Упражнение для проверки"><option value="">Автоматический подбор</option><option v-for="exercise in catalog" :key="exercise.id" :value="exercise.id">{{ exercise.title }}</option></select>
        </label>
        <p class="text-xs text-slate-400">Обычная разминка использует текущие настройки. Пресеты строгости меняют только строгость, «С деталями» включает детали, «Перед новой формой» подготавливает историю.</p>
        <div class="flex flex-wrap gap-2"><button v-for="preset in ([['normal', 'Обычная разминка'], ['stage-up', 'Перед новой формой'], ['soft', 'Мягкий режим'], ['medium', 'Средний · 80%'], ['hardcore', 'Hardcore · удержание'], ['details', 'С деталями']] as const)" :key="preset[0]" type="button" class="setting-chip" :disabled="busy || state?.activePopup" @click="command({ action: 'popup', preset: preset[0], ...(exerciseId ? { exerciseId } : {}) })">{{ preset[1] }}</button></div>
        <p class="text-xs text-amber-300">{{ state?.activePopup ? 'Окно ожидает результат' : 'Активного упражнения нет' }}</p>
      </div>
      <div class="settings-card space-y-3"><h2 class="text-sm font-semibold text-white">Время, отсутствие и ошибки</h2><div class="lab-controls"><label>Сдвиг, секунд<input v-model.number="jumpSeconds" type="number" min="0" max="86400"></label><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'advance', seconds: jumpSeconds })">Продвинуть время</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'advance', seconds: 1 })">+1 с</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'advance', seconds: 300 })">+5 мин · таймаут / snooze</button></div>
        <div class="flex flex-wrap gap-2"><button type="button" class="setting-chip" @click="changeSetting(() => settings.togglePause())">{{ settings.paused ? 'Снять паузу' : 'Поставить на паузу' }}</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'idle', seconds: 90 })">Нет пользователя · 90 с</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'idle', seconds: 600 })">Долгий перерыв · 10 мин</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'idle', seconds: 0 })">Вернулся</button><button type="button" class="setting-chip" :disabled="busy || !state?.activePopup" @click="command({ action: 'fail-save' })">Ошибка следующей записи</button></div>
        <p class="text-xs text-slate-500">После ошибки нажмите «Готово» повторно: запись должна появиться один раз. Анимации и удержание кнопки идут с обычной скоростью.</p>
      </div>
      <details class="settings-card"><summary class="cursor-pointer text-sm text-white">Проверка звуков</summary><div class="mt-3 flex flex-wrap gap-2"><button v-for="cue in SOUND_CUES" :key="cue" type="button" class="setting-chip" @click="playCue(cue)">{{ SOUND_CUE_LABELS[cue] }}</button></div><p class="mt-2 text-xs text-slate-500">Прослушивание включает звук независимо от общего переключателя.</p></details>
      <details class="settings-card"><summary class="cursor-pointer text-sm text-white">Нативная проверка размещения окна</summary><ul class="mt-3 list-disc space-y-2 pl-5 text-xs text-slate-400"><li>Масштаб Windows: 100%, 125%, 150% — текст и кнопки помещаются.</li><li>Несколько мониторов и панель задач с разных сторон — окно внутри рабочей области.</li><li>Раскрытие деталей и ошибка — окно растёт вверх без обрезания.</li><li>Появление не забирает фокус; повторный вызов не создаёт второе упражнение.</li><li>Закрытие, откладывание, таймаут и успех дают ожидаемое состояние трея.</li></ul></details>
    </section>

    <div v-else-if="tab === 'appearance'" class="space-y-4">
      <p class="text-xs text-slate-400">Состояния ниже меняют только ручной предпросмотр. Персонажа профиля можно выбрать рядом со сценой слева.</p>
    </div>
    <div v-else-if="tab === 'sound'" class="space-y-4">
      <p class="text-xs text-slate-400">Прослушивание сгенерированного пакета. Это ручная проверка: она не меняет настройки звука, профиль или историю.</p>
      <SoundAuditionPanel />
    </div>
    <div v-else-if="tab === 'data'" class="space-y-4">
      <p class="text-xs text-slate-400">Данные сохраняются только в тестовом профиле. Фотографии добавляются в деталях настоящей разминки.</p>
      <ComfortSettingsPanel group="data" />
      <WeightCard v-if="settings.weight.enabled" />
      <section v-if="settings.photos.enabled" class="settings-card space-y-4"><h2 class="text-sm font-semibold text-white">Тестовые фотографии</h2><PhotoGallery :photos="photos.entries" @remove="photos.remove" /></section>
    </div>
    <div v-else class="space-y-4"><PreferencesPanel /><ComfortSettingsPanel group="presentation" />
      <button type="button" class="setting-chip" :disabled="busy || !plan || state?.activePopup" @click="command({ action: 'restore-preferences' })">Восстановить параметры сценария</button>
      <p class="text-xs text-slate-400">Восстанавливает исходные настройки и телосложение, сохраняя историю и позицию.</p>
    </div>
    <KeepAlive><AppearancePanel v-if="tab === 'appearance'" :native-preview="state?.visualPreview" @change="manualVisual = $event" /></KeepAlive>
    <details v-if="tab === 'appearance'" class="settings-card mt-4"><summary class="cursor-pointer text-sm text-slate-300">Персонажи тестового профиля</summary><div class="mt-4"><CharacterSettingsPanel :preview="false" /></div></details>
    </SectionTabs>
    </div>
    </div>

    <footer class="flex flex-wrap items-center gap-2 border-t border-slate-700 pt-4">
      <button type="button" class="setting-chip" :disabled="busy || !plan" @click="command({ action: 'save' })">Сохранить вариант</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'restore' })">Восстановить</button><button type="button" class="setting-chip" :disabled="busy || !plan" @click="command({ action: 'export' })">Экспорт JSON</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'import' })">Импорт JSON</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'reset-history' })">Сбросить только историю</button><button type="button" class="setting-chip text-amber-300" :disabled="busy" @click="command({ action: 'reset' })">Сбросить историю и настройки</button>
    </footer>
    <p v-if="state?.message" class="text-xs leading-relaxed text-amber-200" role="status">{{ state.message }}</p>
    <p v-if="error" class="text-sm text-red-300" role="alert">{{ error }}</p>
  </div>
</template>
