<script setup lang="ts">
import { nowDate, nowMs } from '@shared/domain/clock'
import { useRuntimeStore } from '@/stores/runtime'
import type { LabDriverCommand } from '@shared/domain/laboratory-playback'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import PopupFeedback from '@/components/character/PopupFeedback.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { usePhotosStore } from '@/stores/photos'
import { photoUrl } from '@/photos'
import {
  HOLD_CONFIRM_MS,
  canFinish,
  formatCountdown
} from '@shared/domain/severity'
import {
  FEELING_LABELS,
  FEELING_VALUES,
  normalizeSessionExtras
} from '@shared/domain/session-extras'
import {
  POPUP_BASE_HEIGHT,
  POPUP_EXTRAS_COLLAPSED_HEIGHT,
  POPUP_EXTRAS_HEIGHT
} from '@shared/constants/popup'
import { useMotionPreference } from '@/motion'
import { reactionDuration, REACTION_TIMING_MS } from '@shared/domain/reaction-timing'
import type { CharacterReactionEvent } from '@shared/domain/character-reaction'
import { cueForSessionStatus, type SoundCue, type VoiceEvent } from '@shared/domain/sounds'
import { computeCharacterProgress } from '@shared/domain/character-progress'
import { CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { localDateKey } from '@shared/domain/stats'
import { useSoundPlayer } from '@/sounds'
import type { Feeling, SessionExtras, SessionStatus } from '@shared/types/session'
import type { PhotoEntry } from '@shared/types/photo'

const sessions = useSessionsStore()
const character = useCharacterStore()
const progress = useProgressStore()
const settings = useSettingsStore()
const photos = usePhotosStore()
const runtime = useRuntimeStore()
const { reduced } = useMotionPreference()
const sounds = useSoundPlayer()

// Entrance/exit animations translate and scale the shell; without this the
// popup window flashes classic scrollbars for the duration of the animation.
document.documentElement.classList.add('window-popup')
onBeforeUnmount(() => document.documentElement.classList.remove('window-popup'))

/** Countdown starts pulsing at this point (CONCEPT §13). */
const URGENT_MS = 10_000

const busy = ref(false)
const started = ref(false)
const resolved = ref(false)
const errorMessage = ref('')
const successLabel = ref('Разминка в зачёт!')
const successDetail = ref('Ещё один шаг к новой форме')
// Start from the known session duration so a medium/hardcore popup never shows
// an enabled «Готово» for the first frame; `onMounted` re-reads it after the
// async session lookup.
const initialDurationMs = Math.max(0, (sessions.current?.durationSec ?? 0) * 1000)
const durationMs = ref(initialDurationMs)
const remainingMs = ref(initialDurationMs)
const holdProgress = ref(0)
const leaving = ref(false)
const exitKind = ref<'done' | 'quiet' | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
let closeRequested = false

// Optional details (CONCEPT §4, §10): hidden unless the user turned them on,
// and collapsed by default so the core cycle stays one exercise + one timer.
const extrasEnabled = computed(() => settings.sessionExtras.enabled)
const photosEnabled = computed(() => settings.photos.enabled)
const detailsEnabled = computed(() => extrasEnabled.value || photosEnabled.value)
const extrasOpen = ref(false)
const repsInput = ref('')
const weightInput = ref('')
const feeling = ref<Feeling | null>(null)
const attachedPhotos = ref<PhotoEntry[]>([])
const photoInput = ref<HTMLInputElement | null>(null)

let timer: ReturnType<typeof setInterval> | null = null
let holdTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeDriver: (() => void) | undefined
let unsubscribeLab: (() => void) | undefined
let driverCommand: LabDriverCommand | null = null
let popupSessionId = ''
const labHighlight = ref('')
const labPaused = ref(false)

function driverAck(kind: 'applied' | 'failed'): void {
  if (!driverCommand) return
  void window.api.labDriverAck({ ...driverCommand, kind }).catch(cause => console.warn('[laboratory] acknowledgement failed', cause))
}

/** The laboratory invokes these same actions; it cannot bypass severity or persistence. */
async function applyDriver(command: LabDriverCommand): Promise<void> {
  if (!runtime.laboratory || command.sessionId !== popupSessionId || resolved.value
    || (driverCommand && (command.generation < driverCommand.generation
      || (command.generation === driverCommand.generation && command.sequence <= driverCommand.sequence)))) return
  driverCommand = command
  if (command.action === 'cancel') { stopHold(); labHighlight.value = ''; return }
  labHighlight.value = command.action.replace('highlight-', '')
  if (command.action.startsWith('highlight-')) { driverAck('applied'); return }
  if (command.action === 'start') {
    startExercise()
    driverAck(started.value ? 'applied' : 'failed')
  } else if (command.action === 'hold') {
    if (canFinishNow.value && severity.value === 'hardcore') { startHold(); driverAck('applied') }
    else driverAck('failed')
  } else if (command.action === 'done' || command.action === 'skipped' || command.action === 'snoozed') {
    // Give the countdown's ordinary 250 ms update a chance to observe a clock revision.
    if (command.action === 'done' && started.value && timerStartedAt !== null) {
      remainingMs.value = Math.max(0, durationMs.value - (nowMs() - timerStartedAt))
    }
    if (command.action === 'done' && !canFinishNow.value) { driverAck('failed'); return }
    await submit(command.action)
  }
}

function reportManualAction(): Promise<void> {
  if (!runtime.laboratory || !popupSessionId) return Promise.resolve()
  labHighlight.value = ''
  driverCommand = null
  return window.api.labDriverAck?.({ sessionId: popupSessionId, kind: 'manual' })
    .catch(cause => console.warn('[laboratory] manual action report failed', cause))
}

function userStart(): void { void reportManualAction(); startExercise() }
function userSubmit(status: SessionStatus): void { void reportManualAction(); void submit(status) }

const severity = computed(() => settings.severity)
const canFinishNow = computed(() =>
  started.value && canFinish(severity.value, remainingMs.value, durationMs.value)
)
const timeLabel = computed(() => formatCountdown(remainingMs.value))
const isUrgent = computed(
  () => started.value && !leaving.value && remainingMs.value > 0 && remainingMs.value <= URGENT_MS
)
const shellClass = computed(() => {
  if (reduced.value) return ''
  if (!leaving.value) return 'popup-in'
  return exitKind.value === 'done' ? 'popup-out-done' : 'popup-out-quiet'
})
const progressPercent = computed(() => {
  if (durationMs.value <= 0) return 100
  const done = (durationMs.value - remainingMs.value) / durationMs.value
  return Math.min(100, Math.max(0, Math.round(done * 100)))
})

const severityHint = computed(() => {
  if (!sessions.current) return 'Готовим упражнение…'
  if (!started.value) return 'Таймер начнётся, когда будешь готов'
  if (severity.value === 'soft') return 'Мягкая строгость — можно завершить сразу'
  if (!canFinishNow.value) return '«Готово» откроется ближе к концу'
  if (severity.value === 'hardcore') return 'Удерживайте «Готово» до заполнения'
  return 'Можно завершать'
})

function startExercise(): void {
  if (!sessions.current || busy.value || started.value) return
  started.value = true
  character.react('active', sessions.history.length)
  sounds.playVoiceEvent('active')
  startTimer()
}

let timerStartedAt: number | null = null
function startTimer(): void {
  const current = sessions.current
  durationMs.value = Math.max(0, (current?.durationSec ?? 0) * 1000)
  remainingMs.value = durationMs.value

  if (timer) clearInterval(timer)
  if (durationMs.value <= 0) return

  const startedAt = nowMs()
  timerStartedAt = startedAt
  timer = setInterval(() => {
    remainingMs.value = Math.max(0, durationMs.value - (nowMs() - startedAt))
  }, 250)
}

/** Window height follows the details block: base → collapsed row → expanded panel. */
function requestedPopupHeight(): number {
  const height = !detailsEnabled.value ? POPUP_BASE_HEIGHT
    : extrasOpen.value ? POPUP_EXTRAS_HEIGHT : POPUP_EXTRAS_COLLAPSED_HEIGHT
  return height + (errorMessage.value ? 36 : 0)
}

watch(
  [detailsEnabled, extrasOpen, errorMessage],
  () => {
    void window.api?.resizePopup?.(requestedPopupHeight())
  },
  { immediate: true }
)

function toggleExtras(): void {
  extrasOpen.value = !extrasOpen.value
}

function toggleFeeling(value: Feeling): void {
  feeling.value = feeling.value === value ? null : value
}

function collectExtras(): SessionExtras {
  if (!detailsEnabled.value || !extrasOpen.value) return {}

  const extras: SessionExtras = extrasEnabled.value
    ? normalizeSessionExtras({
        reps: repsInput.value,
        feeling: feeling.value,
        weightKg: weightInput.value
      })
    : {}

  if (photosEnabled.value && attachedPhotos.value.length > 0) {
    extras.photoIds = attachedPhotos.value.map((photo) => photo.id)
  }
  return extras
}

async function onPhotoPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const entry = await photos.add(file, sessions.current?.id)
    if (entry) attachedPhotos.value = [...attachedPhotos.value, entry]
    else errorMessage.value = 'Фото не добавлено. Разминку можно завершить без него.'
  } catch (cause) {
    console.error('[popup] optional photo upload failed', cause)
    errorMessage.value = 'Фото не добавлено. Разминку можно завершить без него.'
  }
}

async function detachPhoto(id: string): Promise<void> {
  await photos.remove(id)
  attachedPhotos.value = attachedPhotos.value.filter((photo) => photo.id !== id)
}

function openPhotoPicker(): void {
  photoInput.value?.click()
}

function stopTimer(): void {
  if (timer) clearInterval(timer)
  timer = null
}

function startHold(): void {
  if (busy.value || !canFinishNow.value || holdTimer) return

  const startedAt = Date.now()
  holdProgress.value = 0
  if (holdTimer) clearInterval(holdTimer)

  holdTimer = setInterval(() => {
    holdProgress.value = Math.min(1, (Date.now() - startedAt) / HOLD_CONFIRM_MS)
    if (holdProgress.value >= 1) {
      stopHold()
      void submit('done')
    }
  }, 50)
}

function stopHold(): void {
  if (holdTimer) clearInterval(holdTimer)
  holdTimer = null
  holdProgress.value = 0
}

function onDoneDown(): void {
  if (severity.value !== 'hardcore') return
  if (!runtime.laboratory) { startHold(); return }
  userHolding = true
  void reportManualAction().then(() => { if (userHolding) startHold() })
}

let userHolding = false
function onDoneUp(): void {
  userHolding = false
  if (severity.value === 'hardcore') stopHold()
}

function onDoneClick(): void {
  // Hardcore confirms via hold only; the click fires right after pointerup.
  if (severity.value === 'hardcore') return
  void reportManualAction()
  void submit('done')
}

function onHoldKeyDown(event: KeyboardEvent): void {
  if (severity.value !== 'hardcore') return
  event.preventDefault()
  if (!event.repeat) onDoneDown()
}

onMounted(async () => {
  try {
    if (!sessions.current) {
      // Main owns the active session; never invent a session when it is missing.
      const active = await window.api?.getCurrentPopup()
      if (active) sessions.beginSession(active.exercise, active.sessionId)
    }
    durationMs.value = Math.max(0, (sessions.current?.durationSec ?? 0) * 1000)
    remainingMs.value = durationMs.value
    if (!sessions.current) errorMessage.value = 'Эта разминка уже закрыта. Вызовите новую из трея.'
  } catch (cause) {
    console.error('[popup] failed to load exercise', cause)
    errorMessage.value = 'Не удалось загрузить разминку. Откройте её ещё раз из трея.'
  }
  character.react('ready', sessions.history.length)
  popupSessionId = sessions.current?.id ?? ''
  if (runtime.laboratory && popupSessionId && window.api.onLabDriver) {
    unsubscribeDriver = window.api.onLabDriver(command => { void applyDriver(command) })
    unsubscribeLab = window.api.onLabChanged(state => {
      if (state.playback?.paused && !labPaused.value) stopHold()
      labPaused.value = state.playback?.paused ?? false
    })
    void window.api.labDriverAck({ sessionId: popupSessionId, kind: 'ready' })
      .catch(cause => console.warn('[laboratory] readiness failed', cause))
  }
  sounds.preload()
  // One sound per event: the character line replaces the short signal, and the
  // shipped effect stays as the fallback when the layer is off or has no take
  // (docs/SOUNDS.md).
  if (!sounds.playVoice('popup')) sounds.play('popup')
})

onBeforeUnmount(() => {
  clearTimeout(feedbackTimer)
  unsubscribeDriver?.()
  unsubscribeLab?.()
  stopTimer()
  stopHold()
})

async function submit(status: SessionStatus): Promise<void> {
  const current = sessions.current
  if (busy.value || resolved.value || !current || (status === 'done' && !canFinishNow.value)) return
  busy.value = true
  errorMessage.value = ''
  stopHold()
  const extras = status === 'done' ? collectExtras() : {}
  const nextStage = computeCharacterProgress([
    ...sessions.history.filter(session => session.id !== current.id), { ...current, status }
  ]).stage
  const stageUp = status === 'done' && nextStage > progress.characterStage
  const today = localDateKey(nowDate())
  const firstDoneToday = !sessions.history.some(session => session.status === 'done' &&
    localDateKey(new Date(session.completedAt ?? session.triggeredAt)) === today)
  const reactionSequence = sessions.history.length + 1
  const cue: SoundCue | null = stageUp ? 'stage-up' : cueForSessionStatus(status)
  const voiceEvent: VoiceEvent = stageUp ? 'stage-up'
    : status === 'snoozed' ? 'snoozed'
      : status === 'skipped' ? 'skipped'
        : firstDoneToday ? 'first-done' : 'done'
  try {
    const response = await window.api?.sessionResult({
      sessionId: current.id,
      exerciseId: current.exerciseId,
      status,
      durationSec: current.durationSec,
      ...extras
    })
    if (!response?.saved) throw new Error('Session was not saved')
    resolved.value = true
    sessions.clearCurrent()
    stopTimer()
    if (status === 'done') {
      character.react(stageUp ? 'stage-up' : firstDoneToday ? 'first-done' : 'done', reactionSequence)
      if (stageUp) {
        successLabel.value = 'Новая форма!'
        successDetail.value = CHARACTER_STAGE_LABELS[nextStage]
      }
    } else {
      character.react(status === 'snoozed' ? 'snoozed' : 'skipped', reactionSequence)
      successLabel.value = status === 'snoozed' ? 'Разминка отложена' : 'Разминка пропущена'
      successDetail.value = status === 'snoozed' ? 'Вернёмся через пять минут' : 'Следующая возможность впереди'
    }
    if (!sounds.playVoiceEvent(voiceEvent)) sounds.play(cue)
    exitKind.value = status === 'done' ? 'done' : 'quiet'
    const event: CharacterReactionEvent = status === 'done' ? stageUp ? 'stage-up' : 'done'
      : status === 'snoozed' ? 'snoozed' : 'skipped'
    feedbackTimer = setTimeout(finishFeedback, reactionDuration(event))
  } catch (cause) {
    console.error('[popup] failed to save result', cause)
    errorMessage.value = 'Не удалось сохранить. Попробуйте ещё раз.'
    // `error/01` is the catalogued failed-session-save line: it may play only
    // after a failed durable save, which is exactly this path.
    if (!sounds.playVoiceEvent('error', { variant: '01' })) sounds.play('error')
    driverAck('failed')
  } finally {
    busy.value = false
  }
}

async function closeResolved(): Promise<void> {
  if (closeRequested) return
  closeRequested = true
  clearTimeout(feedbackTimer)
  try {
    if (runtime.laboratory && resolved.value) {
      await window.api.labDriverAck({ sessionId: popupSessionId, kind: 'feedback-complete' })
        .catch(cause => console.warn('[laboratory] feedback acknowledgement failed', cause))
    }
    await window.api?.closePopup()
  }
  catch (cause) {
    closeRequested = false
    console.error('[popup] result saved; failed to close window', cause)
    leaving.value = false
    errorMessage.value = 'Результат сохранён. Можно закрыть окно.'
  }
}

/** Reading and exit are separate phases; reducing motion never shortens the reading time. */
function finishFeedback(): void {
  leaving.value = true
  feedbackTimer = setTimeout(() => { void closeResolved() }, reduced.value ? 0 : REACTION_TIMING_MS.exit)
}
</script>

<template>
  <div class="relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 p-3" :class="shellClass" :style="{ '--popup-exit-duration': `${REACTION_TIMING_MS.exit}ms` }">
    <div
      v-if="resolved && exitKind === 'done' && !reduced"
      class="popup-flash pointer-events-none absolute inset-0 z-20"
    />
    <PopupFeedback v-if="resolved" :character="character.state" :reaction="character.reaction" :quiet="exitKind === 'quiet'"
      :label="successLabel" :detail="successDetail" :error="errorMessage" @close="closeResolved" />
    <template v-if="!resolved">
    <p v-if="runtime.laboratory && labPaused" class="text-[10px] text-amber-300">Сценарий на паузе</p>
    <ComicBubble v-if="!resolved" compact :variant="character.reaction.variant" :animation-id="character.reaction.animationId"
      :caption="character.reaction.caption" :tone="character.reaction.tone" class="popup-speech" />
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
          Body Debugger
        </p>
        <h1 class="line-clamp-2 text-sm font-semibold leading-snug text-slate-50">
          {{ sessions.currentExercise?.title ?? 'Упражнение' }}
        </h1>
        <p class="mt-1 line-clamp-3 text-xs text-slate-400">
          {{ sessions.currentExercise?.description ?? 'Один попап — одно упражнение.' }}
        </p>
      </div>
      <CharacterPortrait :pack-id="settings.characterPackId"
        variant="face"
        size="sm"
        :stage="character.state.stage"
        :branch="character.state.branch"
        :build="character.state.build"
        :emotion="character.emotion"
      />
    </header>

    <div class="flex items-center gap-3">
      <span
        class="w-14 text-2xl font-semibold tabular-nums"
        :class="isUrgent ? 'timer-urgent text-amber-300' : 'text-slate-100'"
      >
        {{ timeLabel }}
      </span>
      <div class="min-w-0 flex-1">
        <div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            class="h-full rounded-full bg-emerald-500 transition-[width] duration-150"
            :style="{ width: `${progressPercent}%` }"
          ></div>
        </div>
        <p class="mt-1 truncate text-[10px] text-slate-500">{{ severityHint }}</p>
      </div>
    </div>

    <p v-if="errorMessage" role="alert" class="text-[11px] text-red-300">{{ errorMessage }}</p>

    <section
      v-if="detailsEnabled"
      class="min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/70"
      data-testid="extras"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
        :aria-expanded="extrasOpen"
        data-testid="extras-toggle"
        @click="toggleExtras"
      >
        <span>{{ photosEnabled ? 'Детали и фото (необязательно)' : 'Детали (необязательно)' }}</span>
        <span aria-hidden="true">{{ extrasOpen ? '▴' : '▾' }}</span>
      </button>

      <div v-if="extrasOpen" class="grid gap-2 px-2 pb-2" data-testid="extras-panel">
        <div v-if="extrasEnabled" class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1 text-[10px] text-slate-500">
            Повторы
            <input
              v-model="repsInput"
              data-testid="reps-input"
              type="number"
              min="1"
              max="999"
              inputmode="numeric"
              placeholder="—"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>
          <label class="flex flex-col gap-1 text-[10px] text-slate-500">
            Вес, кг
            <input
              v-model="weightInput"
              data-testid="weight-input"
              type="number"
              min="20"
              max="300"
              step="0.1"
              placeholder="—"
              class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div v-if="extrasEnabled" class="flex items-center justify-between gap-2">
          <span class="text-[10px] text-slate-500">Ощущения</span>
          <div class="flex gap-1">
            <button
              v-for="value in FEELING_VALUES"
              :key="value"
              type="button"
              class="h-6 w-6 rounded-md text-[11px] transition"
              :class="
                feeling === value
                  ? 'bg-emerald-500 font-semibold text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              "
              :title="FEELING_LABELS[value]"
              :aria-label="FEELING_LABELS[value]"
              :aria-pressed="feeling === value"
              :data-feeling="value"
              @click="toggleFeeling(value)"
            >
              {{ value }}
            </button>
          </div>
        </div>

        <div v-if="photosEnabled" class="flex flex-wrap items-center gap-2" data-testid="photo-attach">
          <button
            type="button"
            data-testid="photo-add"
            class="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
            @click="openPhotoPicker"
          >
            Добавить фото
          </button>
          <input
            ref="photoInput"
            data-testid="photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="onPhotoPicked"
          />
          <ul v-if="attachedPhotos.length" class="flex gap-1">
            <li v-for="photo in attachedPhotos" :key="photo.id" class="relative">
              <img
                :src="photoUrl(photo.id)"
                alt="Фото прогресса"
                class="h-8 w-8 rounded object-cover"
              />
              <button
                type="button"
                data-testid="photo-remove"
                class="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-slate-950 text-[10px] text-slate-300"
                aria-label="Удалить фото"
                @click="detachPhoto(photo.id)"
              >
                ×
              </button>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <div class="mt-auto flex items-center gap-2">
      <button v-if="!sessions.current && !resolved" type="button" class="setting-chip" @click="closeResolved">Закрыть</button>
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="busy || !sessions.current"
        :data-lab-highlight="labHighlight === 'snoozed'"
        @click="userSubmit('snoozed')"
      >
        Отложить
      </button>
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="busy || !sessions.current"
        :data-lab-highlight="labHighlight === 'skipped'"
        @click="userSubmit('skipped')"
      >
        Пропустить
      </button>
      <button v-if="!started"
        type="button" class="ml-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
        :disabled="busy || !sessions.current" data-testid="start-exercise" :data-lab-highlight="labHighlight === 'start'" @click="userStart">Начать</button>
      <button v-else
        type="button"
        class="relative ml-auto overflow-hidden rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:bg-slate-700"
        :disabled="busy || !sessions.current || !canFinishNow"
        :data-lab-highlight="labHighlight === 'done' || labHighlight === 'hold'"
        @click="onDoneClick"
        @pointerdown="onDoneDown"
        @pointerup="onDoneUp"
        @pointerleave="onDoneUp"
        @pointercancel="onDoneUp"
        @blur="onDoneUp"
        @keydown.space="onHoldKeyDown"
        @keydown.enter="onHoldKeyDown"
        @keyup.space="onDoneUp"
        @keyup.enter="onDoneUp"
      >
        <span
          v-if="holdProgress > 0"
          class="absolute inset-y-0 left-0 bg-emerald-300/60"
          :style="{ width: `${holdProgress * 100}%` }"
        ></span>
        <span class="relative">Готово</span>
      </button>
    </div>
    </template>
  </div>
</template>
