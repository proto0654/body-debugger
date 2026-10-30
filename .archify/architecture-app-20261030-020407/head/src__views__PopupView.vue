<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
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
import { POPUP_EXIT_MS, useMotionPreference } from '@/motion'
import type { Feeling, SessionExtras, SessionStatus } from '@shared/types/session'

const sessions = useSessionsStore()
const character = useCharacterStore()
const settings = useSettingsStore()
const { reduced } = useMotionPreference()

// Entrance/exit animations translate and scale the shell; without this the
// popup window flashes classic scrollbars for the duration of the animation.
document.documentElement.classList.add('window-popup')
onBeforeUnmount(() => document.documentElement.classList.remove('window-popup'))

/** Countdown starts pulsing at this point (CONCEPT §13). */
const URGENT_MS = 10_000

const busy = ref(false)
// Start from the known session duration so a medium/hardcore popup never shows
// an enabled «Готово» for the first frame; `onMounted` re-reads it after the
// async session lookup.
const initialDurationMs = Math.max(0, (sessions.current?.durationSec ?? 0) * 1000)
const durationMs = ref(initialDurationMs)
const remainingMs = ref(initialDurationMs)
const holdProgress = ref(0)
const leaving = ref(false)
const exitKind = ref<'done' | 'quiet' | null>(null)

// Optional details (CONCEPT §4, §10): hidden unless the user turned them on,
// and collapsed by default so the core cycle stays one exercise + one timer.
const extrasEnabled = computed(() => settings.sessionExtras.enabled)
const extrasOpen = ref(false)
const repsInput = ref('')
const weightInput = ref('')
const feeling = ref<Feeling | null>(null)

let timer: ReturnType<typeof setInterval> | null = null
let holdTimer: ReturnType<typeof setInterval> | null = null

const severity = computed(() => settings.severity)
const canFinishNow = computed(() =>
  canFinish(severity.value, remainingMs.value, durationMs.value)
)
const timeLabel = computed(() => formatCountdown(remainingMs.value))
const isUrgent = computed(
  () => !leaving.value && remainingMs.value > 0 && remainingMs.value <= URGENT_MS
)
const shellClass = computed(() => {
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
  if (severity.value === 'soft') return 'Мягкая строгость — можно завершить сразу'
  if (!canFinishNow.value) return '«Готово» откроется ближе к концу'
  if (severity.value === 'hardcore') return 'Удерживайте «Готово» до заполнения'
  return 'Можно завершать'
})

function startTimer(): void {
  const current = sessions.current
  durationMs.value = Math.max(0, (current?.durationSec ?? 0) * 1000)
  remainingMs.value = durationMs.value

  if (timer) clearInterval(timer)
  if (durationMs.value <= 0) return

  const startedAt = Date.now()
  timer = setInterval(() => {
    remainingMs.value = Math.max(0, durationMs.value - (Date.now() - startedAt))
  }, 250)
}

/** Window height follows the details block: base → collapsed row → expanded panel. */
function requestedPopupHeight(): number {
  if (!extrasEnabled.value) return POPUP_BASE_HEIGHT
  return extrasOpen.value ? POPUP_EXTRAS_HEIGHT : POPUP_EXTRAS_COLLAPSED_HEIGHT
}

watch([extrasEnabled, extrasOpen], () => {
  void window.api?.resizePopup?.(requestedPopupHeight())
})

function toggleExtras(): void {
  extrasOpen.value = !extrasOpen.value
}

function toggleFeeling(value: Feeling): void {
  feeling.value = feeling.value === value ? null : value
}

function collectExtras(): SessionExtras {
  if (!extrasEnabled.value || !extrasOpen.value) return {}

  return normalizeSessionExtras({
    reps: repsInput.value,
    feeling: feeling.value,
    weightKg: weightInput.value
  })
}

function stopTimer(): void {
  if (timer) clearInterval(timer)
  timer = null
}

function startHold(): void {
  if (busy.value || !canFinishNow.value) return

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
  if (severity.value === 'hardcore') startHold()
}

function onDoneUp(): void {
  if (severity.value === 'hardcore') stopHold()
}

function onDoneClick(): void {
  // Hardcore confirms via hold only; the click fires right after pointerup.
  if (severity.value === 'hardcore') return
  void submit('done')
}

onMounted(async () => {
  if (!sessions.current) {
    // Main owns the active session; the popup may load before or after the trigger.
    const active = await window.api?.getCurrentPopup()
    if (active) {
      sessions.beginSession(active.exercise, active.sessionId)
    } else {
      sessions.beginSession()
    }
  }
  startTimer()
  character.setEmotion('focused')
})

onBeforeUnmount(() => {
  stopTimer()
  stopHold()
})

async function submit(status: SessionStatus): Promise<void> {
  if (busy.value) return
  busy.value = true
  stopTimer()
  stopHold()

  if (status === 'done') {
    character.setEmotion('happy')
  } else if (status === 'skipped') {
    character.setEmotion('tired')
  }

  // Details only describe a completed exercise; snooze / skip never carry them.
  const extras = status === 'done' ? collectExtras() : {}
  const session = sessions.recordResult(status, extras)
  if (session && window.api) {
    await window.api.sessionResult({
      sessionId: session.id,
      exerciseId: session.exerciseId,
      status: session.status,
      durationSec: session.durationSec,
      ...extras
    })
    await playExit(status)
    await window.api.closePopup()
  }
  busy.value = false
}

/** Let the exit animation finish before the window closes (CONCEPT §13). */
async function playExit(status: SessionStatus): Promise<void> {
  if (reduced.value) return
  exitKind.value = status === 'done' ? 'done' : 'quiet'
  leaving.value = true
  await new Promise((resolve) =>
    setTimeout(resolve, status === 'done' ? POPUP_EXIT_MS.done : POPUP_EXIT_MS.quiet)
  )
}
</script>

<template>
  <div class="relative flex h-full flex-col gap-2 p-3" :class="shellClass">
    <div
      v-if="leaving && exitKind === 'done'"
      class="popup-flash pointer-events-none absolute inset-0 z-20"
    />
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
          Body Debugger
        </p>
        <h1 class="truncate text-sm font-semibold text-slate-50">
          {{ sessions.currentExercise?.title ?? 'Упражнение' }}
        </h1>
        <p class="mt-1 line-clamp-2 text-xs text-slate-400">
          {{ sessions.currentExercise?.description ?? 'Один попап — одно упражнение.' }}
        </p>
      </div>
      <CharacterPortrait
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

    <section
      v-if="extrasEnabled"
      class="rounded-lg border border-slate-800 bg-slate-900/70"
      data-testid="extras"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
        :aria-expanded="extrasOpen"
        data-testid="extras-toggle"
        @click="toggleExtras"
      >
        <span>Детали (необязательно)</span>
        <span aria-hidden="true">{{ extrasOpen ? '▴' : '▾' }}</span>
      </button>

      <div v-if="extrasOpen" class="grid gap-2 px-2 pb-2" data-testid="extras-panel">
        <div class="grid grid-cols-2 gap-2">
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

        <div class="flex items-center justify-between gap-2">
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
      </div>
    </section>

    <div class="mt-auto flex items-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="busy || !sessions.current"
        @click="submit('snoozed')"
      >
        Отложить
      </button>
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="busy || !sessions.current"
        @click="submit('skipped')"
      >
        Пропустить
      </button>
      <button
        type="button"
        class="relative ml-auto overflow-hidden rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:bg-slate-700"
        :disabled="busy || !sessions.current || !canFinishNow"
        @click="onDoneClick"
        @pointerdown="onDoneDown"
        @pointerup="onDoneUp"
        @pointerleave="onDoneUp"
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
</template>
