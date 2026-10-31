<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from './CharacterPortrait.vue'
import ComicBubble from './ComicBubble.vue'
import ProgressDynamics from './ProgressDynamics.vue'
import CalendarHeatmap from '@/components/stats/CalendarHeatmap.vue'
import StatsPanel from '@/components/stats/StatsPanel.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { mergeCatalogs } from '@shared/domain/ai-proposal'
import { characterConditionLabel } from '@shared/domain/character-condition'
import { localDateKey } from '@shared/domain/stats'
import {
  buildChronicle,
  chronicleDateIndex,
  chronicleExplanation,
  chroniclePrefix,
  chronicleSummary
} from '@shared/domain/chronicle'

const props = defineProps<{ now: Date }>()
const emit = defineEmits<{ start: [] }>()

const sessions = useSessionsStore()
const settings = useSettingsStore()
const progress = useProgressStore()
const customExercises = useCustomExercisesStore()
const catalog = computed(() => mergeCatalogs(EXERCISE_CATALOG, customExercises.entries))

const chronicle = computed(() => buildChronicle(sessions.history, { now: props.now, catalog: catalog.value }))
const entries = computed(() => chronicle.value.entries)
const cursor = ref(0)
const playing = ref(false)
const speed = ref(1500)
const stepUnit = ref<'event' | 'day' | 'milestone'>('event')
let timer: ReturnType<typeof setTimeout> | undefined

const current = computed(() => entries.value[cursor.value] ?? null)
const summary = computed(() => chronicleSummary(chronicle.value, cursor.value))
const prefix = computed(() => chroniclePrefix(chronicle.value, cursor.value))
const cursorDate = computed(() => (current.value ? new Date(current.value.at) : props.now))
const positionDate = computed(() => localDateKey(cursorDate.value))
const dateLabel = computed(() => cursorDate.value.toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' }))
const explanation = computed(() => chronicleExplanation(chronicle.value, cursor.value))
const milestones = computed(() => chronicle.value.milestoneIndexes)
const atEnd = computed(() => entries.value.length === 0 || cursor.value >= entries.value.length - 1)

const stage = computed(() => summary.value?.character.stage ?? 0)
const branch = computed(() => summary.value?.character.branch ?? 'neutral')
const conditionLevel = computed(() => summary.value?.condition.level ?? 0)
const conditionPoints = computed(() => summary.value?.condition.points ?? 0)
const recovery = computed(() => summary.value?.condition.recoverySessions ?? 0)
const journeyDone = computed(() => summary.value?.journey.done ?? 0)
const journeyRemaining = computed(() => summary.value?.journey.remaining ?? 0)
const journeyNext = computed(() => summary.value?.journey.nextStage ?? null)
const streakCurrent = computed(() => summary.value?.streak.current ?? 0)
const streakMax = computed(() => summary.value?.streak.max ?? 0)
const conditionLabel = computed(() => characterConditionLabel(conditionLevel.value, progress.characterBuild))
const tone = computed(() => (current.value?.milestone ? 'milestone' : current.value?.session?.status === 'done' ? 'cheer' : 'calm'))
const milestoneHint = computed(() => (journeyNext.value === null
  ? 'Пиковая форма достигнута'
  : `До формы «${CHARACTER_STAGE_LABELS[journeyNext.value]}»: ${journeyRemaining.value}`))

const events = computed(() => {
  const start = Math.max(0, cursor.value - 4)
  return entries.value.slice(start, start + 10).map((entry, offset) => ({ ...entry, index: start + offset }))
})

function stop(): void {
  playing.value = false
  if (timer) clearTimeout(timer)
  timer = undefined
}

function schedule(): void {
  if (!playing.value) return
  if (atEnd.value) { stop(); return }
  timer = setTimeout(() => {
    if (!playing.value) return
    cursor.value += 1
    schedule()
  }, speed.value)
}

function togglePlay(): void {
  if (playing.value) { stop(); return }
  if (entries.value.length < 2) return
  if (atEnd.value) cursor.value = 0
  playing.value = true
  schedule()
}

function seek(index: number): void {
  stop()
  cursor.value = Math.min(Math.max(0, index), Math.max(0, entries.value.length - 1))
}

function step(direction: -1 | 1, unit: 'event' | 'day' | 'milestone' = stepUnit.value): void {
  if (!entries.value.length) return
  stop()
  let next = cursor.value + direction
  if (unit === 'milestone') {
    const candidates = milestones.value.filter(index => (direction > 0 ? index > cursor.value : index < cursor.value))
    next = direction > 0 ? candidates[0] ?? cursor.value : candidates[candidates.length - 1] ?? cursor.value
  } else if (unit === 'day') {
    const day = localDateKey(cursorDate.value)
    while (next >= 0 && next < entries.value.length && localDateKey(new Date(entries.value[next]!.at)) === day) {
      next += direction
    }
  }
  seek(next)
}

function jumpToDate(value: string): void {
  const index = chronicleDateIndex(chronicle.value, value)
  if (index !== null) seek(index)
}

function milestoneLabel(index: number): string {
  const entry = entries.value[index]
  if (!entry) return ''
  const date = new Date(entry.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return `${date} · форма ${entry.stage + 1} · ${CHARACTER_BRANCH_LABELS[entry.branch]}`
}

function pauseWhenHidden(): void {
  if (document.hidden) stop()
}

let initialized = false
watch(() => entries.value.length, (next, previous) => {
  if (next === 0) { cursor.value = 0; initialized = false; stop(); return }
  if (!initialized) { cursor.value = next - 1; initialized = true; return }
  const wasAtEnd = previouslyAtEnd(previous)
  if (wasAtEnd) cursor.value = next - 1
  else if (cursor.value >= next) cursor.value = next - 1
}, { immediate: true })

function previouslyAtEnd(previous: number | undefined): boolean {
  if (previous === undefined) return true
  return cursor.value >= previous - 1
}

watch(speed, () => {
  if (!playing.value) return
  if (timer) clearTimeout(timer)
  schedule()
})

onMounted(() => document.addEventListener('visibilitychange', pauseWhenHidden))
onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', pauseWhenHidden)
})
</script>

<template>
  <section v-if="!entries.length" class="settings-card space-y-3" data-testid="chronicle-empty">
    <p class="brand-label text-amber-300">ХРОНИКА</p>
    <h2 class="text-xl font-semibold text-white">История формы</h2>
    <p class="max-w-xl text-sm leading-relaxed text-slate-400">Пока нет истории. Первая разминка начнёт хронику — здесь можно будет прокрутить прошлое и увидеть, как менялись форма, серия и календарь.</p>
    <button type="button" class="primary-action" @click="emit('start')">Размяться сейчас ↗</button>
  </section>

  <div v-else class="chronicle lab-workspace" data-testid="chronicle">
    <aside class="space-y-4">
      <section class="settings-card lab-live" data-testid="chronicle-scene">
        <div class="flex flex-col items-center justify-center gap-3">
          <span class="character-badge">ФОРМА {{ stage + 1 }} / 6</span>
          <CharacterPortrait :pack-id="settings.characterPackId" :stage="stage" :branch="branch" :build="progress.characterBuild" :condition="conditionLevel" :emotion="'neutral'" size="xl" :show-label="false" />
          <div class="text-center">
            <p class="font-semibold text-white">{{ CHARACTER_STAGE_LABELS[stage] }}</p>
            <p class="mt-1 text-xs text-emerald-400">{{ CHARACTER_BRANCH_LABELS[branch] }}</p>
          </div>
        </div>
        <div class="space-y-3">
          <ComicBubble :caption="current?.label ?? ''" :tone="tone" compact />
          <div class="grid grid-cols-3 gap-2">
            <div class="metric-card"><p>Выполнено</p><strong>{{ journeyDone }}</strong></div>
            <div class="metric-card"><p>Серия</p><strong>{{ streakCurrent }}</strong></div>
            <div class="metric-card"><p>Ухудшение</p><strong>{{ conditionPoints }}<small class="text-sm text-slate-500"> / 10</small></strong></div>
          </div>
          <p class="text-sm text-slate-300">{{ conditionLabel }} · уровень {{ conditionLevel }}. До восстановления: {{ recovery }} выполнений.</p>
          <p class="text-xs text-slate-400">{{ milestoneHint }}. Рекорд серии: {{ streakMax }}.</p>
          <p class="text-[11px] text-slate-500">Это просмотр истории. Форма, серия и настройки профиля не меняются.</p>
        </div>
      </section>
      <ProgressDynamics :sessions="prefix" :now="cursorDate" :start-at="chronicle.firstAt ?? undefined" />
    </aside>

    <div class="lab-main min-w-0 space-y-4">
      <section class="settings-card space-y-3" data-testid="chronicle-transport" aria-label="Прокрутка истории">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="brand-label text-amber-300">ПРОСМОТР ИСТОРИИ</p>
            <h2 class="mt-1 font-semibold text-white">{{ dateLabel }}</h2>
          </div>
          <span class="text-xs text-slate-400">{{ cursor + 1 }} / {{ entries.length }}</span>
        </div>
        <input class="lab-range w-full" aria-label="Позиция в истории" type="range" min="0" :max="entries.length - 1" :value="cursor" @change="seek(Number(($event.target as HTMLInputElement).value))">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="primary-action !px-3 !py-2 !text-xs" data-testid="chronicle-play" @click="togglePlay">{{ playing ? 'Пауза' : atEnd ? '▶ Проиграть с начала' : '▶ Проиграть' }}</button>
          <button type="button" class="setting-chip" @click="seek(0)">Сначала</button>
          <button type="button" class="setting-chip" aria-label="Шаг назад" @click="step(-1)">←</button>
          <button type="button" class="setting-chip" aria-label="Шаг вперёд" @click="step(1)">→</button>
          <button type="button" class="setting-chip" @click="seek(entries.length - 1)">В конец</button>
        </div>
        <div class="lab-controls">
          <label>Шаг<select v-model="stepUnit"><option value="event">Событие</option><option value="day">День</option><option value="milestone">Изменение формы / серии</option></select></label>
          <label>Темп<select v-model.number="speed"><option :value="3500">Медленно · 3,5 с</option><option :value="1500">Обычно · 1,5 с</option><option :value="500">Быстро · 0,5 с</option></select></label>
          <label>Перейти к дате<input type="date" :value="positionDate" @change="jumpToDate(($event.target as HTMLInputElement).value)"></label>
        </div>
        <p class="text-sm text-amber-200" aria-live="polite" data-testid="chronicle-position">{{ current?.label }}</p>
        <p class="text-xs leading-relaxed text-slate-400">{{ explanation }}</p>
        <details v-if="milestones.length > 1">
          <summary class="cursor-pointer text-xs text-slate-400">Контрольные точки · {{ milestones.length }}</summary>
          <div class="mt-3 flex flex-wrap gap-2">
            <button v-for="index in milestones" :key="index" type="button" class="setting-chip" @click="seek(index)">{{ milestoneLabel(index) }}</button>
          </div>
        </details>
      </section>

      <section class="settings-card space-y-3" data-testid="chronicle-calendar">
        <h2 class="text-sm font-semibold text-white">Календарь до выбранного момента</h2>
        <CalendarHeatmap :key="`${cursor}-${positionDate}`" :sessions="prefix" :now="cursorDate" :catalog="catalog" />
      </section>

      <details class="settings-card">
        <summary class="cursor-pointer text-sm font-semibold text-white">Статистика и события</summary>
        <div class="mt-4 space-y-5">
          <StatsPanel :sessions="prefix" :now="cursorDate" :catalog="catalog" />
          <ol class="space-y-1">
            <li v-for="event in events" :key="event.index">
              <button type="button" class="lab-event" :class="{ current: event.index === cursor, future: event.index > cursor }" @click="seek(event.index)">
                <span class="w-28 shrink-0 text-slate-500">{{ new Date(event.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>{{ event.label }}
              </button>
            </li>
          </ol>
        </div>
      </details>
    </div>
  </div>
</template>
