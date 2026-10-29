<script setup lang="ts">
import { computed, ref } from 'vue'
import DebugPanel from '@/debug/DebugPanel.vue'
import { isDebugEnabled } from '@/debug/is-debug-enabled'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import WeightCard from '@/components/weight/WeightCard.vue'
import CalendarHeatmap from '@/components/stats/CalendarHeatmap.vue'
import StatsPanel from '@/components/stats/StatsPanel.vue'
import PhotoGallery from '@/components/photos/PhotoGallery.vue'
import AiProposalPanel from '@/components/ai/AiProposalPanel.vue'
import { usePhotosStore } from '@/stores/photos'
import { useProgressStore } from '@/stores/progress'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { useReminderStore } from '@/stores/reminder'
import { useSessionsStore } from '@/stores/sessions'
import { CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import { THEMES } from '@shared/constants/themes'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { mergeCatalogs } from '@shared/domain/ai-proposal'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { SEVERITY_LABELS, SEVERITY_ORDER } from '@shared/domain/severity'
import type { SeverityLevel } from '@shared/types/settings'

type TabId = 'today' | 'calendar' | 'stats' | 'debug'

const tab = ref<TabId>('today')
const progress = useProgressStore()
const character = useCharacterStore()
const settings = useSettingsStore()
const reminder = useReminderStore()
const sessions = useSessionsStore()
const photos = usePhotosStore()
const customExercises = useCustomExercisesStore()

const statsCatalog = computed(() =>
  mergeCatalogs(EXERCISE_CATALOG, customExercises.entries)
)

const debugEnabled = isDebugEnabled()

const tabs = computed<{ id: TabId; label: string }[]>(() => [
  { id: 'today', label: 'Сегодня' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'stats', label: 'Статистика' },
  ...(debugEnabled ? [{ id: 'debug' as const, label: 'Debug' }] : [])
])

const severityOptions = SEVERITY_ORDER.map((id) => ({ id, label: SEVERITY_LABELS[id] }))

const motionOptions: { reduce: boolean; label: string }[] = [
  { reduce: false, label: 'Обычные' },
  { reduce: true, label: 'Уменьшить' }
]

/** Shared on/off switch labels for every optional layer. */
const toggleOptions: { enabled: boolean; label: string }[] = [
  { enabled: false, label: 'Выкл' },
  { enabled: true, label: 'Вкл' }
]

const lastDone = computed(
  () => [...sessions.history].reverse().find((session) => session.status === 'done') ?? null
)

const lastDetails = computed(() => {
  const session = lastDone.value
  if (!session) return ''

  const parts: string[] = []
  if (session.reps !== undefined) parts.push(`${session.reps} повторов`)
  if (session.feeling !== undefined) parts.push(`ощущение ${session.feeling}/5`)
  if (session.weightKg !== undefined) parts.push(`вес ${session.weightKg} кг`)
  return parts.join(' · ')
})

async function triggerReminder(): Promise<void> {
  await window.api?.openPopup()
}

async function togglePause(): Promise<void> {
  await settings.togglePause()
}

async function setSeverity(next: SeverityLevel): Promise<void> {
  await settings.setSeverity(next)
}

async function setReduceMotion(next: boolean): Promise<void> {
  await settings.setReduceMotion(next)
}

async function setTheme(next: string): Promise<void> {
  await settings.setTheme(next)
}

async function setSessionExtras(next: boolean): Promise<void> {
  await settings.setSessionExtrasEnabled(next)
}

async function setWeight(next: boolean): Promise<void> {
  await settings.setWeightEnabled(next)
}

async function setInventory(next: boolean): Promise<void> {
  await settings.setInventoryEnabled(next)
}

async function toggleInventoryItem(id: string): Promise<void> {
  await settings.toggleInventoryItem(id)
}

async function setAi(next: boolean): Promise<void> {
  await settings.setAiEnabled(next)
}

async function setPhotos(next: boolean): Promise<void> {
  await settings.setPhotosEnabled(next)
  if (next) await photos.refresh()
}

async function removePhoto(id: string): Promise<void> {
  await photos.remove(id)
}

async function setSound(next: boolean): Promise<void> {
  await settings.setSoundEnabled(next)
}

async function setVolume(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  await settings.setSoundVolume(Number(input.value) / 100)
}
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-3xl flex-col gap-6 p-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Body Debugger
        </p>
        <h1 class="mt-1 text-2xl font-semibold text-white">Дашборд</h1>
        <p class="mt-1 text-sm text-slate-400">
          Прогресс и настройки хранятся локально (JSON).
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
          @click="togglePause"
        >
          {{ settings.paused ? 'Продолжить' : 'Пауза' }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          @click="triggerReminder"
        >
          Напоминание сейчас
        </button>
      </div>
    </header>

    <nav class="flex gap-1 rounded-xl bg-slate-900 p-1">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        class="flex-1 rounded-lg px-3 py-2 text-sm transition"
        :class="
          tab === item.id
            ? 'bg-slate-700 text-white'
            : 'text-slate-400 hover:text-slate-200'
        "
        @click="tab = item.id"
      >
        {{ item.label }}
      </button>
    </nav>

    <section v-if="tab === 'today'" class="grid gap-6 sm:grid-cols-[auto_1fr]">
      <CharacterPortrait
        size="lg"
        :stage="character.state.stage"
        :branch="character.state.branch"
        :build="character.state.build"
        :emotion="character.emotion"
      />
      <div class="space-y-3">
        <p class="text-sm text-slate-300">
          Форма:
          <span class="font-medium text-white">
            {{ CHARACTER_STAGE_LABELS[progress.characterStage] }}
          </span>
        </p>
        <p class="text-sm text-slate-300">
          Стрик:
          <span class="font-medium text-emerald-400">{{ progress.streak.current }}</span>
          <span class="text-slate-500"> / max {{ progress.streak.max }}</span>
        </p>
        <p v-if="lastDetails" class="text-xs text-slate-500">
          Последняя сессия: {{ lastDetails }}
        </p>
        <p class="text-sm text-slate-300">Интервал: {{ settings.intervalMinutes }} мин</p>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">Строгость:</span>
          <button
            v-for="option in severityOptions"
            :key="option.id"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.severity === option.id
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setSeverity(option.id)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2" data-testid="theme-controls">
          <span class="text-xs text-slate-500">Тема:</span>
          <button
            v-for="option in THEMES"
            :key="option.id"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.themeId === option.id
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            :title="option.description"
            @click="setTheme(option.id)"
          >
            {{ option.title }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">Анимации:</span>
          <button
            v-for="option in motionOptions"
            :key="String(option.reduce)"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.reduceMotion === option.reduce
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setReduceMotion(option.reduce)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">Детали в попапе:</span>
          <button
            v-for="option in toggleOptions"
            :key="String(option.enabled)"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.sessionExtras.enabled === option.enabled
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setSessionExtras(option.enabled)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">Вес:</span>
          <button
            v-for="option in toggleOptions"
            :key="String(option.enabled)"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.weight.enabled === option.enabled
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setWeight(option.enabled)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2" data-testid="inventory-controls">
          <span class="text-xs text-slate-500">Инвентарь:</span>
          <button
            v-for="option in toggleOptions"
            :key="String(option.enabled)"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.inventory.enabled === option.enabled
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setInventory(option.enabled)"
          >
            {{ option.label }}
          </button>
        </div>
        <div
          v-if="settings.inventory.enabled"
          class="flex flex-wrap gap-1"
          data-testid="inventory-items"
        >
          <button
            v-for="item in EQUIPMENT_CATALOG"
            :key="item.id"
            type="button"
            class="rounded-lg px-2 py-1 text-xs transition"
            :class="
              settings.inventory.items.includes(item.id)
                ? 'bg-emerald-500 font-semibold text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            :aria-pressed="settings.inventory.items.includes(item.id)"
            @click="toggleInventoryItem(item.id)"
          >
            {{ item.emoji }} {{ item.title }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2" data-testid="ai-controls">
          <span class="text-xs text-slate-500">AI-предложения:</span>
          <button
            v-for="option in toggleOptions"
            :key="String(option.enabled)"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.ai.enabled === option.enabled
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setAi(option.enabled)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2" data-testid="photo-controls">
          <span class="text-xs text-slate-500">Фото:</span>
          <button
            v-for="option in toggleOptions"
            :key="String(option.enabled)"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.photos.enabled === option.enabled
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setPhotos(option.enabled)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2" data-testid="sound-controls">
          <span class="text-xs text-slate-500">Звуки:</span>
          <button
            v-for="option in toggleOptions"
            :key="String(option.enabled)"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="
              settings.sound.enabled === option.enabled
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            "
            @click="setSound(option.enabled)"
          >
            {{ option.label }}
          </button>
          <input
            v-if="settings.sound.enabled"
            type="range"
            min="0"
            max="100"
            step="5"
            :value="Math.round(settings.sound.volume * 100)"
            aria-label="Громкость звуков"
            data-testid="sound-volume"
            class="h-1 w-24 accent-emerald-500"
            @change="setVolume"
          />
        </div>
        <p
          class="text-xs"
          :class="reminder.paused ? 'text-amber-400' : 'text-slate-500'"
        >
          {{ reminder.nextTriggerLabel }}
        </p>
      </div>
    </section>

    <section
      v-else-if="tab === 'calendar'"
      class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 class="text-sm font-semibold text-white">Активность за 13 недель</h2>
      <CalendarHeatmap :sessions="sessions.history" :catalog="statsCatalog" />
    </section>

    <section
      v-else-if="tab === 'stats'"
      class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 class="mb-3 text-sm font-semibold text-white">Статистика</h2>
      <StatsPanel :sessions="sessions.history" :catalog="statsCatalog" />
    </section>

    <DebugPanel v-else />

    <WeightCard v-if="tab === 'today' && settings.weight.enabled" />

    <AiProposalPanel v-if="tab === 'today' && settings.ai.enabled" />

    <section
      v-if="tab === 'today' && settings.photos.enabled"
      class="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 class="text-sm font-semibold text-white">Фото прогресса</h2>
      <PhotoGallery :photos="photos.entries" @remove="removePhoto" />
    </section>
  </div>
</template>
