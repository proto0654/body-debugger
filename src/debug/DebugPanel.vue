<script setup lang="ts">
import { computed, ref } from 'vue'
import { applySnapshot } from '@/bootstrap/hydrate'
import { createSoundPlayer } from '@/sounds'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { mergeCatalogs } from '@shared/domain/ai-proposal'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { SOUND_CUES, type SoundCue } from '@shared/domain/sounds'
import { pickNextExercise } from '@shared/domain/exercise-picker'
import type {
  DebugApplyScenarioPayload
} from '@shared/types/events'
import type {
  CharacterBranch,
  CharacterBuild,
  CharacterEmotion,
  CharacterStage
} from '@shared/types/character'
import type { SessionStatus } from '@shared/types/session'
import { DEBUG_SCENARIOS, buildDebugScenario, type DebugScenarioId } from './scenarios'
import { isDebugEnabled } from './is-debug-enabled'

const props = defineProps<{ enabled?: boolean; now?: Date }>()

const settings = useSettingsStore()
const progress = useProgressStore()
const sessions = useSessionsStore()
const character = useCharacterStore()
const customExercises = useCustomExercisesStore()

const enabled = computed(() => props.enabled ?? isDebugEnabled())
const now = computed(() => props.now ?? new Date())

const nextPick = computed(() =>
  pickNextExercise({
    catalog: mergeCatalogs(EXERCISE_CATALOG, customExercises.entries),
    recentSessions: sessions.history,
    settings: settings.asSettings(),
    now: now.value,
    // Keep the debug "next pick" stable between renders.
    random: () => 0
  })
)

const recentSessions = computed(() => [...sessions.history].slice(-5).reverse())
const statusMessage = ref('')
const busy = ref(false)

const statusLabels: Record<SessionStatus, string> = {
  done: 'Выполнено',
  skipped: 'Пропущено',
  snoozed: 'Отложено',
  missed: 'Пропущено по таймауту'
}

const sessionStatuses: SessionStatus[] = ['done', 'snoozed', 'skipped', 'missed']
const stages: CharacterStage[] = [0, 1, 2, 3, 4, 5]
const branches: CharacterBranch[] = ['neutral', 'posture', 'power', 'mobility']
const builds: CharacterBuild[] = ['lean', 'average', 'stocky', 'neutral']

const emotions: CharacterEmotion[] = [
  'neutral',
  'focused',
  'happy',
  'proud',
  'tired',
  'surprised'
]

const preview = createSoundPlayer({
  createAudio: (src) => new Audio(src),
  // The debug preview ignores the master switch: each cue must be audible here.
  getSettings: () => ({
    ...settings.sound,
    enabled: true,
    volume: Math.max(0.1, settings.sound.volume)
  }),
  isPaused: () => false
})

async function send(payload: DebugApplyScenarioPayload, message: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const snapshot = await window.api?.applyDebugScenario(payload)
    if (snapshot) applySnapshot(snapshot)
    statusMessage.value = message
  } finally {
    busy.value = false
  }
}

async function applyScenario(id: DebugScenarioId): Promise<void> {
  const scenario = DEBUG_SCENARIOS.find((entry) => entry.id === id)
  if (!scenario) return

  const result = buildDebugScenario(id, {
    now: now.value,
    settings: settings.asSettings(),
    progress: progress.asUserProgress()
  })
  await send(result, `Сценарий: ${scenario.title}`)
}

async function resetHistory(): Promise<void> {
  const base = progress.asUserProgress()
  await send(
    {
      sessions: [],
      settings: settings.asSettings(),
      progress: {
        ...base,
        streak: { current: 0, max: 0 },
        characterStage: 0,
        characterBranch: 'neutral',
        exerciseLevels: {}
      }
    },
    'История и прогресс сброшены'
  )
}

async function trigger(): Promise<void> {
  await window.api?.openPopup()
  statusMessage.value = 'Попап вызван вручную'
}

async function simulate(status: SessionStatus): Promise<void> {
  const exercise = nextPick.value
  await window.api?.sessionResult({
    sessionId: crypto.randomUUID(),
    exerciseId: exercise.id,
    status,
    durationSec: exercise.durationSec
  })
  statusMessage.value = `Симуляция: ${statusLabels[status]} · ${exercise.title}`
}

function playCue(cue: SoundCue): void {
  preview.play(cue)
  statusMessage.value = `Звук: ${cue}`
}

function setEmotion(emotion: CharacterEmotion): void {
  character.setEmotion(emotion)
  statusMessage.value = `Эмоция: ${emotion}`
}

async function forceStage(stage: CharacterStage): Promise<void> {
  progress.characterStage = stage
  await progress.persist()
  statusMessage.value = `Стадия: ${stage}`
}

async function forceBranch(branch: CharacterBranch): Promise<void> {
  progress.characterBranch = branch
  await progress.persist()
  statusMessage.value = `Ветка: ${branch}`
}

async function forceBuild(build: CharacterBuild): Promise<void> {
  progress.characterBuild = build
  await progress.persist()
  statusMessage.value = `Билд: ${build}`
}
</script>

<template>
  <section
    v-if="enabled"
    data-testid="debug-panel"
    class="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"
  >
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-sm font-semibold text-amber-300">Debug / сценарии</h2>
      <span class="text-[10px] text-amber-500/80">Только dev-сборка</span>
    </header>

    <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <p class="rounded-lg bg-slate-900 p-2 text-slate-400">
        Стадия
        <span class="block font-semibold text-white" data-testid="debug-stage">
          {{ progress.characterStage }} · {{ CHARACTER_STAGE_LABELS[progress.characterStage] }}
        </span>
      </p>
      <p class="rounded-lg bg-slate-900 p-2 text-slate-400">
        Ветка
        <span class="block font-semibold text-white" data-testid="debug-branch">
          {{ progress.characterBranch }}
        </span>
      </p>
      <p class="rounded-lg bg-slate-900 p-2 text-slate-400">
        Focus
        <span class="block font-semibold text-white" data-testid="debug-focus">
          {{ settings.focus.primary ?? 'нет' }}
        </span>
      </p>
      <p class="rounded-lg bg-slate-900 p-2 text-slate-400">
        Эмоция
        <span class="block font-semibold text-white" data-testid="debug-emotion">
          {{ character.emotion }}
        </span>
      </p>
    </div>

    <div class="rounded-lg bg-slate-900 p-2 text-xs text-slate-400">
      Следующее упражнение:
      <span class="text-slate-200">{{ nextPick.title }}</span>
      <span class="text-slate-500"> · {{ nextPick.category }} · {{ nextPick.durationSec }} с</span>
    </div>

    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Персонаж
      </h3>
      <div class="flex flex-wrap items-center gap-1" data-testid="debug-stage-controls">
        <span class="text-[10px] text-slate-500">Стадия:</span>
        <button
          v-for="stage in stages"
          :key="stage"
          type="button"
          :data-debug-stage="stage"
          class="rounded-lg px-2 py-1 text-xs"
          :class="
            progress.characterStage === stage
              ? 'bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          "
          @click="forceStage(stage)"
        >
          {{ stage }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-1" data-testid="debug-branch-controls">
        <span class="text-[10px] text-slate-500">Ветка:</span>
        <button
          v-for="branch in branches"
          :key="branch"
          type="button"
          :data-debug-branch="branch"
          class="rounded-lg px-2 py-1 text-xs"
          :class="
            progress.characterBranch === branch
              ? 'bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          "
          @click="forceBranch(branch)"
        >
          {{ branch }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-1" data-testid="debug-build-controls">
        <span class="text-[10px] text-slate-500">Билд:</span>
        <button
          v-for="build in builds"
          :key="build"
          type="button"
          :data-debug-build="build"
          class="rounded-lg px-2 py-1 text-xs"
          :class="
            progress.characterBuild === build
              ? 'bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          "
          @click="forceBuild(build)"
        >
          {{ build }}
        </button>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Быстрые действия
      </h3>
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          data-testid="debug-trigger"
          class="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
          @click="trigger"
        >
          Напоминание сейчас
        </button>
        <button
          v-for="status in sessionStatuses"
          :key="status"
          type="button"
          :data-testid="`debug-simulate-${status}`"
          class="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
          @click="simulate(status)"
        >
          Симуляция: {{ statusLabels[status] }}
        </button>
        <button
          type="button"
          data-testid="debug-reset"
          class="rounded-lg bg-red-900/60 px-2 py-1 text-xs text-red-200 hover:bg-red-900"
          @click="resetHistory"
        >
          Сбросить историю
        </button>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Сценарии
      </h3>
      <div class="grid gap-1 sm:grid-cols-2">
        <button
          v-for="scenario in DEBUG_SCENARIOS"
          :key="scenario.id"
          type="button"
          :data-debug-scenario="scenario.id"
          class="rounded-lg bg-slate-800 px-2 py-1 text-left text-xs text-slate-200 hover:bg-slate-700"
          @click="applyScenario(scenario.id)"
        >
          <span class="block font-medium">{{ scenario.title }}</span>
          <span class="block text-[10px] text-slate-500">{{ scenario.description }}</span>
        </button>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Эмоции
      </h3>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="emotion in emotions"
          :key="emotion"
          type="button"
          :data-debug-emotion="emotion"
          class="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          @click="setEmotion(emotion)"
        >
          {{ emotion }}
        </button>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Звуки
      </h3>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="cue in SOUND_CUES"
          :key="cue"
          type="button"
          :data-debug-sound="cue"
          class="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          @click="playCue(cue)"
        >
          {{ cue }}
        </button>
      </div>
    </section>

    <section class="space-y-1">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Последние сессии
      </h3>
      <p v-if="recentSessions.length === 0" class="text-xs text-slate-500">История пуста</p>
      <ul v-else class="space-y-0.5 text-[11px] text-slate-400">
        <li v-for="session in recentSessions" :key="session.id">
          {{ session.exerciseId }} · {{ session.status }} ·
          {{ new Date(session.triggeredAt).toLocaleDateString('ru-RU') }}
        </li>
      </ul>
    </section>

    <p v-if="statusMessage" class="text-xs text-amber-300" data-testid="debug-status">
      {{ statusMessage }}
    </p>
  </section>
</template>
