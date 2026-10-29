<script setup lang="ts">
import { ref } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import { useProgressStore } from '@/stores/progress'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { useReminderStore } from '@/stores/reminder'
import { CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { SEVERITY_LABELS, SEVERITY_ORDER } from '@shared/domain/severity'
import type { SeverityLevel } from '@shared/types/settings'

type TabId = 'today' | 'calendar' | 'stats'

const tab = ref<TabId>('today')
const progress = useProgressStore()
const character = useCharacterStore()
const settings = useSettingsStore()
const reminder = useReminderStore()

const tabs: { id: TabId; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'stats', label: 'Статистика' }
]

const severityOptions = SEVERITY_ORDER.map((id) => ({ id, label: SEVERITY_LABELS[id] }))

async function triggerReminder(): Promise<void> {
  await window.api?.openPopup()
}

async function togglePause(): Promise<void> {
  await settings.togglePause()
}

async function setSeverity(next: SeverityLevel): Promise<void> {
  await settings.setSeverity(next)
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
      class="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500"
    >
      Heatmap календаря — следующий этап.
    </section>

    <section
      v-else
      class="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500"
    >
      Графики и распределение по зонам — следующий этап.
    </section>
  </div>
</template>
