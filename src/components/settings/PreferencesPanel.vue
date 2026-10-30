<script setup lang="ts">
import CharacterPicker from '@/components/character/CharacterPicker.vue'
import { CHARACTER_BUILD_LABELS, CHARACTER_BUILDS } from '@shared/constants/character'
import { FOCUS_DIRECTIONS, FOCUS_LABELS } from '@shared/constants/focus'
import {
  INTERVAL_MINUTES_MAX,
  INTERVAL_MINUTES_MIN,
  INTERVAL_PRESETS,
  PICKER_MODES,
  PICKER_MODE_HINTS,
  PICKER_MODE_LABELS,
  normalizeIntervalMinutes
} from '@shared/domain/preferences'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import type { CharacterBuild } from '@shared/types/character'
import type { FocusDirection } from '@shared/types/progress'
import type { ExercisePickerMode } from '@shared/types/settings'

/**
 * Core preferences (CONCEPT.md §6–7): rhythm, picker mode, Focus and the
 * character build. ComfortSettingsPanel owns the optional-layer switches.
 */
const settings = useSettingsStore()
const progress = useProgressStore()

/** `neutral` means "not chosen"; the picker only offers the three real builds. */
const buildOptions = CHARACTER_BUILDS.filter((build) => build !== 'neutral')

function chipClass(active: boolean): string {
  return active ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
}

/** Invalid input is rejected by the domain rule; the field snaps back to the stored value. */
async function onIntervalChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const minutes = normalizeIntervalMinutes(input.value)

  if (minutes !== null) await settings.setIntervalMinutes(minutes)
  input.value = String(settings.intervalMinutes)
}

async function applyPreset(minutes: number): Promise<void> {
  await settings.setIntervalMinutes(minutes)
}

async function setMode(mode: ExercisePickerMode): Promise<void> {
  await settings.setPickerMode(mode)
}

async function setPrimary(direction: FocusDirection | null): Promise<void> {
  await settings.setFocusPrimary(direction)
}

async function toggleAccent(direction: FocusDirection): Promise<void> {
  await settings.toggleFocusAccent(direction)
}

async function setBuild(build: CharacterBuild): Promise<void> {
  await progress.setCharacterBuild(build)
}
</script>

<template>
  <div class="grid gap-4" data-testid="preferences-panel">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"><CharacterPicker /></section>
    <section
      class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
      data-testid="interval-control"
    >
      <h2 class="text-sm font-semibold text-white">Интервал напоминаний</h2>
      <p class="mt-1 text-xs text-slate-500">
        От {{ INTERVAL_MINUTES_MIN }} до {{ INTERVAL_MINUTES_MAX }} минут; отсчёт идёт от
        последнего ответа на попап.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <input
          :value="settings.intervalMinutes"
          type="number"
          :min="INTERVAL_MINUTES_MIN"
          :max="INTERVAL_MINUTES_MAX"
          step="1"
          inputmode="numeric"
          aria-label="Интервал в минутах"
          data-testid="interval-input"
          class="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
          @change="onIntervalChange"
        />
        <span class="text-xs text-slate-500">мин</span>
        <button
          v-for="preset in INTERVAL_PRESETS"
          :key="preset"
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs transition"
          :class="chipClass(settings.intervalMinutes === preset)"
          :aria-pressed="settings.intervalMinutes === preset"
          :data-interval-preset="preset"
          @click="applyPreset(preset)"
        >
          {{ preset }}
        </button>
      </div>
    </section>

    <section
      class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
      data-testid="picker-mode-controls"
    >
      <h2 class="text-sm font-semibold text-white">Режим подбора</h2>
      <p class="mt-1 text-xs text-slate-500">{{ PICKER_MODE_HINTS[settings.pickerMode] }}</p>
      <div class="mt-3 flex flex-wrap gap-1">
        <button
          v-for="mode in PICKER_MODES"
          :key="mode"
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs transition"
          :class="chipClass(settings.pickerMode === mode)"
          :aria-pressed="settings.pickerMode === mode"
          :data-picker-mode="mode"
          @click="setMode(mode)"
        >
          {{ PICKER_MODE_LABELS[mode] }}
        </button>
      </div>
    </section>

    <section
      class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
      data-testid="focus-controls"
    >
      <h2 class="text-sm font-semibold text-white">Направления</h2>
      <p class="mt-1 text-xs text-slate-500">
        Основное направление и акценты смещают вероятности, но не отменяют чередование зон.
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-2" data-testid="focus-primary-controls">
        <span class="text-xs text-slate-500">Основное:</span>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs transition"
          :class="chipClass(settings.focus.primary === null)"
          :aria-pressed="settings.focus.primary === null"
          data-focus-primary="none"
          @click="setPrimary(null)"
        >
          Нет
        </button>
        <button
          v-for="direction in FOCUS_DIRECTIONS"
          :key="direction"
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs transition"
          :class="chipClass(settings.focus.primary === direction)"
          :aria-pressed="settings.focus.primary === direction"
          :data-focus-primary="direction"
          @click="setPrimary(settings.focus.primary === direction ? null : direction)"
        >
          {{ FOCUS_LABELS[direction] }}
        </button>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-2" data-testid="focus-accent-controls">
        <span class="text-xs text-slate-500">Акценты:</span>
        <button
          v-for="direction in FOCUS_DIRECTIONS"
          :key="direction"
          type="button"
          :disabled="settings.focus.primary === direction"
          class="rounded-lg px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40"
          :class="chipClass(settings.focus.accents.includes(direction))"
          :aria-pressed="settings.focus.accents.includes(direction)"
          :data-focus-accent="direction"
          @click="toggleAccent(direction)"
        >
          {{ FOCUS_LABELS[direction] }}
        </button>
      </div>
    </section>

    <section
      class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
      data-testid="build-controls"
    >
      <h2 class="text-sm font-semibold text-white">Сложение персонажа</h2>
      <p class="mt-1 text-xs text-slate-500">
        Влияет только на внешний вид: стадия и ветка считаются из истории.
      </p>
      <div class="mt-3 flex flex-wrap gap-1">
        <button
          v-for="build in buildOptions"
          :key="build"
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs transition"
          :class="chipClass(progress.characterBuild === build)"
          :aria-pressed="progress.characterBuild === build"
          :data-build="build"
          @click="setBuild(build)"
        >
          {{ CHARACTER_BUILD_LABELS[build] }}
        </button>
      </div>
    </section>
  </div>
</template>
