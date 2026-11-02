<script setup lang="ts">
import { nowDate, nowMs } from '@shared/domain/clock'
import { useRuntimeStore } from '@/stores/runtime'
import type { LabDriverCommand, LabPlaybackMode } from '@shared/domain/laboratory-playback'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import PopupFeedback from '@/components/character/PopupFeedback.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import {
  HOLD_CONFIRM_MS,
  canFinish,
  formatCountdown
} from '@shared/domain/severity'
import { POPUP_BASE_HEIGHT } from '@shared/constants/popup'
import { useMotionPreference } from '@/motion'
import { reactionDuration, REACTION_TIMING_MS } from '@shared/domain/reaction-timing'
import type { CharacterReactionEvent } from '@shared/domain/character-reaction'
import { cueForSessionStatus, type SoundCue, type VoiceEvent } from '@shared/domain/sounds'
import { computeCharacterProgress } from '@shared/domain/character-progress'
import { CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { localDateKey } from '@shared/domain/stats'
import { useSoundPlayer, type SoundPlayer } from '@/sounds'
import type { SessionStatus } from '@shared/types/session'
import type { SessionPopupCharacter } from '@shared/types/events'

const sessions = useSessionsStore()
const character = useCharacterStore()
const progress = useProgressStore()
const settings = useSettingsStore()
const runtime = useRuntimeStore()
const { reduced } = useMotionPreference()
/** Scope is finalized on mount from `getCurrentPopup().preview` (chronicle vs live). */
let sounds: SoundPlayer = useSoundPlayer('live')
const previewMode = ref(false)
const previewCharacter = ref<SessionPopupCharacter | null>(null)
const playbackMode = ref<LabPlaybackMode>('automatic')
const labPlaying = ref(false)
const arcadeAborted = ref(false)
/** Laboratory clock or chronicle preview — both accept LabDriver commands. */
const drivenPlayback = computed(() => !!runtime.laboratory || previewMode.value)
/**
 * Automatic arcade locks controls while a scenario is actually playing.
 * Standalone lab popups (manual checks) stay clickable.
 */
const arcadeLocked = computed(() =>
  drivenPlayback.value
  && playbackMode.value === 'automatic'
  && !arcadeAborted.value
  && (previewMode.value || labPlaying.value)
)
const portraitPackId = computed(() => previewCharacter.value?.packId ?? settings.characterPackId)
const portraitStage = computed(() => previewCharacter.value?.stage ?? character.state.stage)
const portraitBranch = computed(() => previewCharacter.value?.branch ?? character.state.branch)
const portraitBuild = computed(() => previewCharacter.value?.build ?? character.state.build)
const portraitEmotion = computed(() => previewCharacter.value?.emotion ?? character.emotion)

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

/** Arcade driver (lab + chronicle preview): same actions as a real click, with timer unlock. */
async function applyDriver(command: LabDriverCommand): Promise<void> {
  if (!drivenPlayback.value || command.sessionId !== popupSessionId || resolved.value
    || (driverCommand && (command.generation < driverCommand.generation
      || (command.generation === driverCommand.generation && command.sequence <= driverCommand.sequence)))) return
  driverCommand = command
  if (command.action === 'cancel') { stopHold(); labHighlight.value = ''; return }
  labHighlight.value = command.action.replace('highlight-', '')
  if (command.action.startsWith('highlight-')) { driverAck('applied'); return }
  if (command.action === 'start') {
    startExercise()
    if (!started.value) { driverAck('failed'); return }
    // Full `active` line before arcade continues to the outcome click.
    await sounds.waitForPlayback()
    if (arcadeAborted.value || resolved.value) return
    driverAck('applied')
  } else if (command.action === 'hold') {
    // Arcade never waits out the real exercise clock — unlock, then hold.
    remainingMs.value = 0
    if (canFinishNow.value && severity.value === 'hardcore') { startHold(); driverAck('applied') }
    else driverAck('failed')
  } else if (command.action === 'done' || command.action === 'skipped' || command.action === 'snoozed') {
    if (command.action === 'done') remainingMs.value = 0
    if (command.action === 'done' && !canFinishNow.value) { driverAck('failed'); return }
    await submit(command.action)
  }
}

function reportManualAction(): Promise<void> {
  if (!drivenPlayback.value || !popupSessionId) return Promise.resolve()
  labHighlight.value = ''
  driverCommand = null
  return window.api.labDriverAck?.({ sessionId: popupSessionId, kind: 'manual' })
    .catch(cause => console.warn('[laboratory] manual action report failed', cause))
}

/** Click-anywhere abort for automatic arcade — never leaves the popup waiting for a human. */
function abortArcade(): void {
  if (!arcadeLocked.value || !popupSessionId) return
  arcadeAborted.value = true
  labHighlight.value = ''
  driverCommand = null
  clearTimeout(feedbackTimer)
  stopHold()
  sounds.stop()
  void window.api.labDriverAck?.({ sessionId: popupSessionId, kind: 'manual' })
    .catch(cause => console.warn('[laboratory] abort failed', cause))
}

function userStart(): void {
  if (arcadeLocked.value) { abortArcade(); return }
  void reportManualAction(); startExercise()
}
function userSubmit(status: SessionStatus): void {
  if (arcadeLocked.value) { abortArcade(); return }
  void reportManualAction(); void submit(status)
}

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

/** Base height, plus a little room when a save error needs to be readable. */
function requestedPopupHeight(): number {
  return POPUP_BASE_HEIGHT + (errorMessage.value ? 36 : 0)
}

watch(
  errorMessage,
  () => {
    void window.api?.resizePopup?.(requestedPopupHeight())
  },
  { immediate: true }
)

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
  if (arcadeLocked.value) { abortArcade(); return }
  if (severity.value !== 'hardcore') return
  if (!drivenPlayback.value) { startHold(); return }
  userHolding = true
  void reportManualAction().then(() => { if (userHolding) startHold() })
}

let userHolding = false
function onDoneUp(): void {
  userHolding = false
  if (severity.value === 'hardcore') stopHold()
}

function onDoneClick(): void {
  if (arcadeLocked.value) { abortArcade(); return }
  // Hardcore confirms via hold only; the click fires right after pointerup.
  if (severity.value === 'hardcore') return
  void reportManualAction()
  void submit('done')
}

function onHoldKeyDown(event: KeyboardEvent): void {
  if (arcadeLocked.value) { abortArcade(); return }
  if (severity.value !== 'hardcore') return
  event.preventDefault()
  if (!event.repeat) onDoneDown()
}

onMounted(async () => {
  try {
    // Main owns the active session; never invent a session when it is missing.
    const active = await window.api?.getCurrentPopup?.()
    if (active) {
      // Chronicle preview reuses this engine but keeps voice rotation off the live profile.
      previewMode.value = !!active.preview
      previewCharacter.value = active.character ?? null
      sounds = useSoundPlayer(active.preview ? 'preview' : 'live')
      if (!sessions.current) sessions.beginSession(active.exercise, active.sessionId)
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
  sounds.preload()
  // One sound per event: the character line replaces the short signal, and the
  // shipped effect stays as the fallback when the layer is off or has no take
  // (docs/SOUNDS.md).
  if (!sounds.playVoice('popup')) sounds.play('popup')
  if (drivenPlayback.value && popupSessionId && window.api.onLabDriver) {
    unsubscribeDriver = window.api.onLabDriver(command => {
      // A driver command means an automatic/interactive run owns this popup.
      if (!previewMode.value) labPlaying.value = true
      void applyDriver(command)
    })
    unsubscribeLab = window.api.onLabChanged?.(state => {
      if (state.playback?.mode === 'automatic' || state.playback?.mode === 'interactive') {
        playbackMode.value = state.playback.mode
      }
      labPlaying.value = !!state.playing
      if (state.playback?.paused && !labPaused.value) stopHold()
      labPaused.value = state.playback?.paused ?? false
    })
    // Arcade must hear the full entry line before it starts clicking.
    await sounds.waitForPlayback()
    if (arcadeAborted.value) return
    void window.api.labDriverAck({ sessionId: popupSessionId, kind: 'ready' })
      .catch(cause => console.warn('[laboratory] readiness failed', cause))
  }
})

onBeforeUnmount(() => {
  clearTimeout(feedbackTimer)
  sounds.stop()
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
  const nextStage = computeCharacterProgress([
    ...sessions.history.filter(session => session.id !== current.id), { ...current, status }
  ]).stage
  const baselineStage = previewCharacter.value?.stage ?? progress.characterStage
  const stageUp = status === 'done' && nextStage > baselineStage
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
      durationSec: current.durationSec
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
    // Floor reading time + full voice line — never cut the replica short.
    void armFeedback(event)
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

async function closeResolved(fromUser = false): Promise<void> {
  if (fromUser && arcadeLocked.value) { abortArcade(); return }
  if (closeRequested || arcadeAborted.value) return
  closeRequested = true
  clearTimeout(feedbackTimer)
  try {
    if (drivenPlayback.value && resolved.value) {
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

/**
 * Wait for the spoken line (player already adds a 1 s tail after `ended`/duration),
 * and never shorter than the reading floor. Manual close can still abort.
 */
async function armFeedback(event: CharacterReactionEvent): Promise<void> {
  const floor = reactionDuration(event)
  const startedAt = Date.now()
  await sounds.waitForPlayback()
  if (closeRequested || !resolved.value) return
  const left = Math.max(0, floor - (Date.now() - startedAt))
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(finishFeedback, left)
}

/** Reading and exit are separate phases; reducing motion never shortens the reading time. */
function finishFeedback(): void {
  leaving.value = true
  feedbackTimer = setTimeout(() => { void closeResolved() }, reduced.value ? 0 : REACTION_TIMING_MS.exit)
}
</script>

<template>
  <div
    class="popup-hud relative flex h-full flex-col overflow-hidden"
    :class="[shellClass, arcadeLocked ? 'cursor-pointer' : '']"
    :style="{ '--popup-exit-duration': `${REACTION_TIMING_MS.exit}ms` }"
    :data-arcade-locked="arcadeLocked ? 'true' : undefined"
    :title="arcadeLocked ? 'Клик — прервать сценарий' : undefined"
    @click="arcadeLocked ? abortArcade() : undefined"
  >
    <div
      v-if="resolved && exitKind === 'done' && !reduced"
      class="popup-flash pointer-events-none absolute inset-0 z-20"
    />
    <PopupFeedback v-if="resolved" :character="character.state" :reaction="character.reaction" :quiet="exitKind === 'quiet'"
      :label="successLabel" :detail="successDetail" :error="errorMessage"
      :hide-close="arcadeLocked"
      @close="closeResolved(true)" />
    <template v-if="!resolved">
    <header class="popup-head">
      <p v-if="arcadeLocked" class="popup-hud-note pointer-events-none">Автопроигрыш · клик — прервать</p>
      <p v-else-if="runtime.laboratory && labPaused" class="popup-hud-note">Сценарий на паузе</p>
      <h1 class="popup-hud-title">
        {{ sessions.currentExercise?.title ?? 'Упражнение' }}
      </h1>
      <p class="popup-hud-copy">
        {{ sessions.currentExercise?.description ?? 'Один попап — одно упражнение.' }}
      </p>
      <p v-if="errorMessage" role="alert" class="popup-hud-alert">{{ errorMessage }}</p>
    </header>
    <div class="popup-body">
      <div class="popup-side">
        <div class="popup-cast">
          <div class="popup-cast-track">
            <div class="popup-cast-fill" :style="{ width: `${progressPercent}%` }"></div>
          </div>
          <span class="popup-cast-time" :class="isUrgent ? 'timer-urgent is-urgent' : ''">{{ timeLabel }}</span>
          <span v-if="sessions.currentExercise?.perSide" class="popup-hud-note">На каждую сторону</span>
        </div>
        <div class="popup-actions" :class="arcadeLocked ? 'pointer-events-none is-locked' : ''">
          <button v-if="!sessions.current && !resolved" type="button" class="popup-action" :disabled="arcadeLocked" @click.stop="closeResolved(true)">Закрыть</button>
          <button
            type="button"
            class="popup-action"
            :disabled="arcadeLocked || busy || !sessions.current"
            :data-lab-highlight="labHighlight === 'snoozed'"
            @click.stop="userSubmit('snoozed')"
          >
            Отложить
          </button>
          <button
            type="button"
            class="popup-action"
            :disabled="arcadeLocked || busy || !sessions.current"
            :data-lab-highlight="labHighlight === 'skipped'"
            @click.stop="userSubmit('skipped')"
          >
            Пропустить
          </button>
          <button v-if="!started"
            type="button" class="popup-action-primary"
            :disabled="arcadeLocked || busy || !sessions.current" data-testid="start-exercise" :data-lab-highlight="labHighlight === 'start'" @click.stop="userStart">Начать</button>
          <button v-else
            type="button"
            class="popup-action-primary relative overflow-hidden disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            :disabled="arcadeLocked || busy || !sessions.current || !canFinishNow"
            :data-lab-highlight="labHighlight === 'done' || labHighlight === 'hold'"
            @click.stop="onDoneClick"
            @pointerdown.stop="onDoneDown"
            @pointerup.stop="onDoneUp"
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
      </div>
      <div class="popup-face">
        <div class="reaction-portrait relative" :data-tone="character.reaction.tone">
          <CharacterPortrait :pack-id="portraitPackId"
            variant="face"
            size="popup"
            :stage="portraitStage"
            :branch="portraitBranch"
            :build="portraitBuild"
            :emotion="portraitEmotion"
          />
          <span class="reaction-accent" aria-hidden="true">{{ character.reaction.decoration }}</span>
          <ComicBubble compact tail="top" :variant="character.reaction.variant" :animation-id="character.reaction.animationId"
            :caption="character.reaction.caption" :tone="character.reaction.tone" :decoration="character.reaction.decoration"
            class="popup-speech" />
        </div>
      </div>
    </div>
    </template>
  </div>
</template>
