<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import CalendarHeatmap from '@/components/stats/CalendarHeatmap.vue'
import StatsPanel from '@/components/stats/StatsPanel.vue'
import AppearancePanel from './AppearancePanel.vue'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { useRuntimeStore } from '@/stores/runtime'
import { LAB_SCENARIOS, labEventExplanation, labMilestones, labSummary, type LabCommand, type LabGeneratorOptions, type LabState } from '@shared/domain/laboratory'
import { nowDate } from '@shared/domain/clock'
import { localDateKey } from '@shared/domain/stats'
import { CHARACTER_BRANCH_LABELS, CHARACTER_BUILD_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { THEMES } from '@shared/constants/themes'
import { SOUND_CUES, cueForSessionStatus, type SoundCue } from '@shared/domain/sounds'
import { characterJourney } from '@shared/domain/character-progress'
import { computeStreak } from '@shared/domain/streak'
import { createSoundPlayer, useSoundPlayer } from '@/sounds'

const state = ref<LabState | null>(null)
const tab = ref<'history' | 'popup' | 'appearance'>('history')
const busy = ref(false)
const error = ref('')
const speed = ref(1500)
const stepUnit = ref<'event' | 'day' | 'milestone'>('event')
const jumpSeconds = ref(60)
const tick = ref(0)
const character = useCharacterStore()
const progress = useProgressStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()
const runtime = useRuntimeStore()
const sounds = useSoundPlayer()
const preview = createSoundPlayer({ createAudio: src => new Audio(src),
  getSettings: () => ({ ...settings.sound, enabled: true, volume: Math.max(0.1, settings.sound.volume) }), isPaused: () => false })
const generator = ref<LabGeneratorOptions>({ days: 30, activity: 'uneven', load: 'normal', direction: 'neutral', seed: 4242, endDate: localDateKey(new Date()) })
let unsubscribe: (() => void) | undefined
let clock: ReturnType<typeof setInterval> | undefined
let reactionTimer: ReturnType<typeof setTimeout> | undefined
const showFace = ref(false)
const now = computed(() => { tick.value; runtime.revision; return nowDate() })
const plan = computed(() => state.value?.plan)
const milestones = computed(() => plan.value ? labMilestones(plan.value) : [])
const expected = computed(() => plan.value ? labSummary(plan.value, state.value?.cursor ?? 0) : null)
const journey = computed(() => characterJourney(sessions.history))
const streak = computed(() => computeStreak(sessions.history, now.value))
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
    error.value = 'Действие не выполнено. Проверьте параметры; для восстановления сначала сохраните вариант. Подробности — в журнале Electron.'
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
function openDashboard(): void { void changeSetting(() => window.api.openDashboard()) }
function milestoneLabel(index: number): string {
  if (!plan.value) return ''
  const summary = labSummary(plan.value, index)
  return `${new Date(plan.value.events[index]!.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · форма ${summary.character.stage} · спад ${summary.condition.level} · ${labEventExplanation(plan.value, index)}`
}

watch([() => journey.value.stage, () => sessions.lastSession?.id], ([stage], [oldStage]) => {
  clearTimeout(reactionTimer)
  showFace.value = false
  if (runtime.laboratory?.silent || !state.value?.playing) return
  const last = sessions.lastSession
  if (!last) return
  const stageUp = stage > oldStage
  character.react(stageUp ? 'stage-up' : last.status === 'done' ? 'done' : last.status === 'snoozed' ? 'snoozed' : 'skipped', sessions.history.length)
  sounds.play(stageUp ? 'stage-up' : cueForSessionStatus(last.status))
  showFace.value = last.status === 'done'
  reactionTimer = setTimeout(() => { showFace.value = false }, 3500)
})
watch(() => runtime.laboratory?.silent, silent => {
  if (silent) { clearTimeout(reactionTimer); showFace.value = false }
})
watch(() => state.value?.plan?.generator, options => {
  if (options) generator.value = { ...options }
})

onMounted(async () => {
  try {
    unsubscribe = window.api.onLabChanged(next => { state.value = next })
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
      <div class="flex gap-2"><button class="setting-chip" type="button" @click="openDashboard">Дашборд ↗</button><button class="setting-chip" type="button" :disabled="busy" @click="command({ action: 'detach' })">Отдельное окно ↗</button></div>
    </header>
    <div class="lab-status"><span class="lab-dot" />Тестовый профиль · {{ dateLabel }}<span class="ml-auto">{{ runtime.laboratory?.running ? 'Время идёт' : 'Время остановлено' }}</span></div>
    <nav class="dashboard-tabs" aria-label="Разделы лаборатории">
      <button type="button" :class="{ 'is-active': tab === 'history' }" @click="tab = 'history'">История персонажа</button>
      <button type="button" :class="{ 'is-active': tab === 'popup' }" @click="tab = 'popup'">Попап и трей</button>
      <button type="button" :class="{ 'is-active': tab === 'appearance' }" @click="tab = 'appearance'">Внешность</button>
    </nav>

    <div class="lab-controls rounded-xl bg-slate-900 p-3">
      <label>Тема<select :value="settings.themeId" @change="changeSetting(() => settings.setTheme(($event.target as HTMLSelectElement).value))"><option v-for="theme in THEMES" :key="theme.id" :value="theme.id">{{ theme.title }}</option></select></label>
      <label>Телосложение<select :value="progress.characterBuild" @change="changeSetting(async () => { progress.characterBuild = ($event.target as HTMLSelectElement).value as typeof progress.characterBuild; await progress.persist() })"><option v-for="(title, key) in CHARACTER_BUILD_LABELS" :key="key" :value="key">{{ title }}</option></select></label>
      <label class="lab-check"><input type="checkbox" :checked="settings.reduceMotion" @change="changeSetting(() => settings.setReduceMotion(($event.target as HTMLInputElement).checked))">Уменьшить анимации</label>
      <label class="lab-check"><input type="checkbox" :checked="settings.sound.enabled" @change="changeSetting(() => settings.setSoundEnabled(($event.target as HTMLInputElement).checked))">Звук</label>
    </div>

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
        <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-white">{{ plan.title }}</h2><span class="text-xs text-slate-400">{{ state.cursor + 1 }} / {{ plan.events.length }}</span></div>
        <input class="lab-range w-full" aria-label="Позиция на таймлайне" type="range" min="0" :max="plan.events.length - 1" :value="state.cursor" :disabled="busy" @change="seek(Number(($event.target as HTMLInputElement).value))">
        <div class="lab-controls">
          <div class="flex items-center gap-1"><button type="button" class="setting-chip" :disabled="busy" @click="seek(0)">В начало</button><button type="button" aria-label="Шаг назад" class="setting-chip" :disabled="busy" @click="command({ action: 'step', direction: -1, unit: stepUnit })">←</button><button type="button" class="setting-chip" :disabled="busy" data-testid="lab-play" @click="command(state.playing ? { action: 'pause' } : { action: 'play', delayMs: speed })">{{ state.playing ? 'Пауза' : '▶ Играть' }}</button><button type="button" aria-label="Шаг вперёд" class="setting-chip" :disabled="busy" @click="command({ action: 'step', direction: 1, unit: stepUnit })">→</button><button type="button" class="setting-chip" :disabled="busy" @click="seek(plan.events.length - 1)">В конец</button></div>
          <label>Шаг<select v-model="stepUnit"><option value="event">Событие</option><option value="day">День</option><option value="milestone">Изменение формы / серии</option></select></label>
          <label>Темп<select v-model="speed"><option :value="3500">Медленно · 3,5 с</option><option :value="1500">Обычно · 1,5 с</option><option :value="500">Быстро · 0,5 с</option></select></label>
          <label>Перейти к дате<input type="date" :value="positionDate" :disabled="busy" @change="command({ action: 'date', date: ($event.target as HTMLInputElement).value })"></label>
        </div>
        <p class="text-sm text-amber-200">{{ current?.label }}</p>
        <p class="text-xs leading-relaxed text-slate-400">{{ explanation }}</p>
        <p v-if="state.interrupted || state.detached" class="text-xs text-amber-400">Ручная проверка изменила состояние. Переход по таймлайну восстановит выбранную точку.</p>
        <details><summary class="cursor-pointer text-xs text-slate-400">Контрольные точки · {{ milestones.length }}</summary><div class="mt-3 flex flex-wrap gap-2"><button v-for="index in milestones" :key="index" type="button" class="setting-chip" :disabled="busy" @click="seek(index)">{{ milestoneLabel(index) }}</button></div></details>
      </div>

      <section class="lab-preview settings-card">
        <div class="flex flex-col items-center justify-center gap-3">
          <CharacterPortrait :stage="progress.characterStage" :branch="progress.characterBranch" :build="progress.characterBuild" :emotion="character.emotion" :condition="character.condition.level" :variant="showFace ? 'face' : 'body'" size="xl" :show-label="false" />
          <div class="text-center"><p class="font-semibold text-white">{{ CHARACTER_STAGE_LABELS[progress.characterStage] }}</p><p class="mt-1 text-xs text-emerald-400">{{ CHARACTER_BRANCH_LABELS[progress.characterBranch] }}</p></div>
        </div>
        <div class="space-y-4">
          <ComicBubble :caption="showFace ? character.reaction.caption : 'СМОТРИМ, КАК МЕНЯЕТСЯ ФОРМА'" :tone="character.reaction.tone" />
          <div class="grid grid-cols-3 gap-2"><div class="metric-card"><p>Выполнено</p><strong>{{ journey.done }}</strong></div><div class="metric-card"><p>Стрик</p><strong>{{ streak.current }}</strong></div><div class="metric-card"><p>Ухудшение</p><strong>{{ character.condition.points }}<small class="text-sm text-slate-500"> / 10</small></strong></div></div>
          <p class="text-sm text-slate-300">{{ character.conditionLabel }} · уровень {{ character.condition.level }}. До восстановления: {{ character.condition.recoverySessions }} выполнений.</p>
          <p class="text-xs text-slate-400">{{ journey.nextStage === null ? 'Пиковая форма достигнута' : `До следующей формы: ${journey.remaining} выполнений` }}. Рекорд серии: {{ streak.max }}.</p>
          <p v-if="actualMatches !== null" class="text-xs" :class="actualMatches ? 'text-emerald-400' : 'text-red-300'" data-testid="lab-checkpoint">{{ actualMatches ? '✓ Состояние соответствует истории до курсора' : 'Состояние отличается от контрольной точки' }}</p>
          <p class="break-all text-[11px] text-slate-500">Кадр: {{ character.visualKey.candidates.join(' → ') }}</p>
        </div>
      </section>
      <section class="settings-card space-y-3"><h2 class="text-sm font-semibold text-white">Календарь до выбранного момента</h2><CalendarHeatmap :sessions="sessions.history" :now="now" /></section>
      <details class="settings-card"><summary class="cursor-pointer text-sm text-white">Статистика и события</summary><div class="mt-4 space-y-5"><StatsPanel :sessions="sessions.history" :now="now" /><ol class="space-y-1"><li v-for="event in events" :key="event.index"><button type="button" class="lab-event" :class="{ current: event.index === state?.cursor, future: event.index > (state?.cursor ?? 0) }" :disabled="busy" @click="seek(event.index)"><span class="w-28 shrink-0 text-slate-500">{{ new Date(event.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>{{ event.label }}</button></li></ol></div></details>
    </template>

    <section v-else-if="tab === 'popup'" class="space-y-4" data-testid="lab-popup">
      <div class="settings-card space-y-3"><h2 class="font-semibold text-white">Настоящий попап у трея</h2><p class="text-xs leading-relaxed text-slate-400">Откройте окно, нажмите «Начать», проверьте таймер и результат. Запись, эмоции и трей проходят через обычный цикл приложения. Любой ручной результат останавливает воспроизведение истории.</p>
        <div class="flex flex-wrap gap-2"><button v-for="preset in ([['normal', 'Обычная разминка'], ['stage-up', 'Перед новой формой'], ['soft', 'Мягкий режим'], ['medium', 'Средний · 80%'], ['hardcore', 'Hardcore · удержание'], ['details', 'С деталями']] as const)" :key="preset[0]" type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'popup', preset: preset[0] })">{{ preset[1] }}</button></div>
        <p class="text-xs text-amber-300">{{ state?.activePopup ? 'Окно ожидает результат' : 'Активного упражнения нет' }}</p>
      </div>
      <div class="settings-card space-y-3"><h2 class="text-sm font-semibold text-white">Время, отсутствие и ошибки</h2><div class="lab-controls"><label>Сдвиг, секунд<input v-model.number="jumpSeconds" type="number" min="0" max="86400"></label><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'advance', seconds: jumpSeconds })">Продвинуть время</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'advance', seconds: 1 })">+1 с</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'advance', seconds: 300 })">+5 мин · таймаут / snooze</button></div>
        <div class="flex flex-wrap gap-2"><button type="button" class="setting-chip" @click="changeSetting(() => settings.togglePause())">{{ settings.paused ? 'Снять паузу' : 'Поставить на паузу' }}</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'idle', seconds: 90 })">Нет пользователя · 90 с</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'idle', seconds: 600 })">Долгий перерыв · 10 мин</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'idle', seconds: 0 })">Вернулся</button><button type="button" class="setting-chip" :disabled="busy || !state?.activePopup" @click="command({ action: 'fail-save' })">Ошибка следующей записи</button></div>
        <p class="text-xs text-slate-500">После ошибки нажмите «Готово» повторно: запись должна появиться один раз. Анимации и удержание кнопки идут с обычной скоростью.</p>
      </div>
      <details class="settings-card"><summary class="cursor-pointer text-sm text-white">Проверка звуков</summary><div class="mt-3 flex flex-wrap gap-2"><button v-for="cue in SOUND_CUES" :key="cue" type="button" class="setting-chip" @click="playCue(cue)">{{ cue }}</button></div><p class="mt-2 text-xs text-slate-500">Прослушивание включает звук независимо от общего переключателя.</p></details>
      <details class="settings-card"><summary class="cursor-pointer text-sm text-white">Нативная проверка размещения окна</summary><ul class="mt-3 list-disc space-y-2 pl-5 text-xs text-slate-400"><li>Масштаб Windows: 100%, 125%, 150% — текст и кнопки помещаются.</li><li>Несколько мониторов и панель задач с разных сторон — окно внутри рабочей области.</li><li>Раскрытие деталей и ошибка — окно растёт вверх без обрезания.</li><li>Появление не забирает фокус; повторный вызов не создаёт второе упражнение.</li><li>Закрытие, откладывание, таймаут и успех дают ожидаемое состояние трея.</li></ul></details>
    </section>

    <AppearancePanel v-else />

    <footer class="flex flex-wrap items-center gap-2 border-t border-slate-700 pt-4">
      <button type="button" class="setting-chip" :disabled="busy || !plan" @click="command({ action: 'save' })">Сохранить вариант</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'restore' })">Восстановить</button><button type="button" class="setting-chip" :disabled="busy || !plan" @click="command({ action: 'export' })">Экспорт JSON</button><button type="button" class="setting-chip" :disabled="busy" @click="command({ action: 'import' })">Импорт JSON</button><button type="button" class="setting-chip text-amber-300" :disabled="busy" @click="command({ action: 'reset' })">Сбросить тестовую историю</button>
    </footer>
    <p v-if="state?.message" class="text-xs leading-relaxed text-amber-200" role="status">{{ state.message }}</p>
    <p v-if="error" class="text-sm text-red-300" role="alert">{{ error }}</p>
  </div>
</template>
