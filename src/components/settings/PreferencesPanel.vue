<script setup lang="ts">
import { ref } from 'vue'
import ComfortSettingsPanel from './ComfortSettingsPanel.vue'
import { SEVERITY_LABELS, SEVERITY_ORDER } from '@shared/domain/severity'
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
import { useSettingsStore } from '@/stores/settings'
import type { FocusDirection } from '@shared/types/progress'
import type { ExercisePickerMode } from '@shared/types/settings'

const settings = useSettingsStore()
const saving = ref(false)
const error = ref('')
async function saveSetting(action: () => Promise<void>): Promise<void> {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try { await action() }
  catch (cause) {
    console.error('[preferences] save failed', cause)
    error.value = 'Не удалось сохранить настройку. Попробуйте ещё раз.'
  } finally { saving.value = false }
}

function chipClass(active: boolean): string {
  return active ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
}

/** Invalid input is rejected by the domain rule; the field snaps back to the stored value. */
async function onIntervalChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const minutes = normalizeIntervalMinutes(input.value)

  if (minutes !== null) await saveSetting(() => settings.setIntervalMinutes(minutes))
  input.value = String(settings.intervalMinutes)
}

async function applyPreset(minutes: number): Promise<void> {
  await saveSetting(() => settings.setIntervalMinutes(minutes))
}

async function setMode(mode: ExercisePickerMode): Promise<void> {
  await saveSetting(() => settings.setPickerMode(mode))
}

async function setPrimary(direction: FocusDirection | null): Promise<void> {
  await saveSetting(() => settings.setFocusPrimary(direction))
}

async function toggleAccent(direction: FocusDirection): Promise<void> {
  await saveSetting(() => settings.toggleFocusAccent(direction))
}

</script>

<template>
  <div class="grid gap-4" data-testid="preferences-panel">
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
          type="number" :disabled="saving"
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
          type="button" :disabled="saving"
          class="rounded-lg px-2.5 py-1 text-xs transition"
          :class="chipClass(settings.intervalMinutes === preset)"
          :aria-pressed="settings.intervalMinutes === preset"
          :data-interval-preset="preset"
          @click="applyPreset(preset)"
        >
          {{ preset }}
        </button>
      </div>
      <div class="mt-4 border-t border-slate-800 pt-4 space-y-2" data-testid="severity-controls">
        <p class="text-sm font-semibold text-white">Подтверждение выполнения</p>
        <div class="flex flex-wrap gap-2"><button v-for="severity in SEVERITY_ORDER" :key="severity" type="button" :disabled="saving" class="setting-chip"
          :aria-pressed="settings.severity === severity" @click="saveSetting(() => settings.setSeverity(severity))">{{ SEVERITY_LABELS[severity] }}</button></div>
        <p class="text-xs text-slate-400">Мягкая — завершить после старта. Средняя — пройти 80% таймера. Жёсткая — дополнительно удержать «Готово».</p>
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
          type="button" :disabled="saving"
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
          type="button" :disabled="saving"
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
          type="button" :disabled="saving"
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
          :disabled="saving || settings.focus.primary === direction"
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

    <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
    <ComfortSettingsPanel group="selection" />
  </div>
</template>
