<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import {
  HOLD_CONFIRM_MS,
  canFinish,
  formatCountdown
} from '@shared/domain/severity'
import type { SessionStatus } from '@shared/types/session'

const sessions = useSessionsStore()
const character = useCharacterStore()
const settings = useSettingsStore()

const busy = ref(false)
const durationMs = ref(0)
const remainingMs = ref(0)
const holdProgress = ref(0)

let timer: ReturnType<typeof setInterval> | null = null
let holdTimer: ReturnType<typeof setInterval> | null = null

const severity = computed(() => settings.severity)
const canFinishNow = computed(() =>
  canFinish(severity.value, remainingMs.value, durationMs.value)
)
const timeLabel = computed(() => formatCountdown(remainingMs.value))
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

  const session = sessions.recordResult(status)
  if (session && window.api) {
    await window.api.sessionResult({
      sessionId: session.id,
      exerciseId: session.exerciseId,
      status: session.status,
      durationSec: session.durationSec
    })
    await window.api.closePopup()
  }
  busy.value = false
}
</script>

<template>
  <div class="flex h-full flex-col gap-2 p-3">
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
        size="sm"
        :stage="character.state.stage"
        :branch="character.state.branch"
        :build="character.state.build"
        :emotion="character.emotion"
        :emoji-fallback="sessions.currentExercise?.emojiFallback ?? '💪'"
      />
    </header>

    <div class="flex items-center gap-3">
      <span class="w-14 text-2xl font-semibold tabular-nums text-slate-100">
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
