<script setup lang="ts">
import { computed, ref } from 'vue'
import ComfortSettingsPanel from './ComfortSettingsPanel.vue'
import { SEVERITY_LABELS, SEVERITY_ORDER } from '@shared/domain/severity'
import {
  INTERVAL_MINUTES_MAX,
  INTERVAL_MINUTES_MIN,
  INTERVAL_PRESETS,
  PICKER_MODES,
  PICKER_MODE_HINTS,
  PICKER_MODE_LABELS,
  normalizeIntervalMinutes
} from '@shared/domain/preferences'
import {
  FOCUS_LEVEL_LABELS,
  LIMITATIONS,
  LIMITATION_LABELS,
  METHODS,
  METHOD_LABELS,
  ZONES,
  ZONE_LABELS
} from '@shared/constants/catalog-axes'
import { useSettingsStore } from '@/stores/settings'
import type { ExercisePickerMode } from '@shared/types/settings'
import type { Limitation, Method, Zone } from '@shared/types/exercise-v2'

const settings = useSettingsStore()
const saving = ref(false)
const error = ref('')

const activeProfileShifts = computed(() => {
  const now = Date.now()
  return settings.profileShifts.filter((shift) => {
    const until = Date.parse(shift.until)
    return !Number.isNaN(until) && until > now
  })
})

function shiftLabel(axis: 'zone' | 'method', key: string): string {
  if (axis === 'zone') return ZONE_LABELS[key as Zone] ?? key
  return METHOD_LABELS[key as Method] ?? key
}

function shiftUntilLabel(until: string): string {
  const date = new Date(until)
  if (Number.isNaN(date.getTime())) return until
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

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

async function cycleZone(zone: Zone): Promise<void> {
  await saveSetting(() => settings.cycleZoneLevel(zone))
}

async function cycleMethod(method: Method): Promise<void> {
  await saveSetting(() => settings.cycleMethodLevel(method))
}

async function toggleLimitation(tag: Limitation): Promise<void> {
  const enabled = !settings.limitations.includes(tag)
  await saveSetting(() => settings.setLimitation(tag, enabled))
}

async function onProfileStrength(event: Event): Promise<void> {
  const value = Number((event.target as HTMLInputElement).value) / 100
  await saveSetting(() => settings.setProfileStrength(value))
}

function focusChipLabel(level: -1 | 0 | 1 | 2): string {
  return FOCUS_LEVEL_LABELS[level]
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
        Две оси: зона (где) и метод (как). Нажми на чип, чтобы переключить уровень — / 0 / + / ++.
      </p>

      <div class="mt-4 space-y-2" data-testid="focus-zone-controls">
        <p class="text-xs font-medium text-slate-400">Зона</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="zone in ZONES"
            :key="zone"
            type="button"
            :disabled="saving"
            class="rounded-lg px-2.5 py-1 text-xs transition min-w-[4.5rem]"
            :class="chipClass(settings.focusV2.zones[zone] !== 0)"
            :aria-label="`${ZONE_LABELS[zone]}: ${focusChipLabel(settings.focusV2.zones[zone])}`"
            @click="cycleZone(zone)"
          >
            {{ ZONE_LABELS[zone] }} · {{ focusChipLabel(settings.focusV2.zones[zone]) }}
          </button>
        </div>
      </div>

      <div class="mt-4 space-y-2" data-testid="focus-method-controls">
        <p class="text-xs font-medium text-slate-400">Метод</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="method in METHODS"
            :key="method"
            type="button"
            :disabled="saving"
            class="rounded-lg px-2.5 py-1 text-xs transition"
            :class="chipClass(settings.focusV2.methods[method] !== 0)"
            :aria-label="`${METHOD_LABELS[method]}: ${focusChipLabel(settings.focusV2.methods[method])}`"
            @click="cycleMethod(method)"
          >
            {{ METHOD_LABELS[method] }} · {{ focusChipLabel(settings.focusV2.methods[method]) }}
          </button>
        </div>
      </div>

      <div class="mt-4 border-t border-slate-800 pt-4">
        <label class="block text-sm font-semibold text-white">Следовать профилю</label>
        <p class="mt-1 text-xs text-slate-500">Насколько жёстко подбор следует этим весам (λ).</p>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          class="mt-3 w-full accent-emerald-500"
          :disabled="saving"
          :value="Math.round(settings.profileStrength * 100)"
          data-testid="profile-strength"
          aria-label="Сила следования профилю"
          @change="onProfileStrength"
        />
        <div class="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>Мягко</span>
          <span>Обычно</span>
          <span>Жёстко</span>
        </div>
      </div>

      <div
        v-if="activeProfileShifts.length > 0"
        class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1"
        data-testid="profile-shifts"
      >
        <p class="text-xs font-medium text-amber-200">Временные сдвиги профиля</p>
        <p
          v-for="(shift, index) in activeProfileShifts"
          :key="`${shift.axis}-${shift.key}-${index}`"
          class="text-xs text-amber-100/80"
        >
          {{ shiftLabel(shift.axis, shift.key) }}
          · {{ focusChipLabel(shift.level) }}
          · до {{ shiftUntilLabel(shift.until) }}
        </p>
      </div>

      <div class="mt-4 border-t border-slate-800 pt-4" data-testid="auto-tune-controls">
        <p class="text-sm font-semibold text-white">Подсказки дозы</p>
        <p class="mt-1 text-xs text-slate-500">Значки в «Упражнения → Наборы»; попап не трогаем.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="mode in (['suggest', 'auto', 'off'] as const)"
            :key="mode"
            type="button"
            class="setting-chip"
            :disabled="saving"
            :aria-pressed="settings.autoTune === mode"
            @click="saveSetting(() => settings.setAutoTune(mode))"
          >
            {{ mode === 'suggest' ? 'Предлагать' : mode === 'auto' ? 'Авто' : 'Выкл' }}
          </button>
        </div>
      </div>

      <div class="mt-4 border-t border-slate-800 pt-4" data-testid="limitations-controls">
        <p class="text-sm font-semibold text-white">Ограничения</p>
        <p class="mt-1 text-xs text-slate-500">
          Локальный фильтр каталога — никуда не отправляется. Упражнения с этими тегами не попадут в подбор.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="tag in LIMITATIONS"
            :key="tag"
            type="button"
            class="setting-chip"
            :disabled="saving"
            :aria-pressed="settings.limitations.includes(tag)"
            @click="toggleLimitation(tag)"
          >
            {{ LIMITATION_LABELS[tag] }}
          </button>
        </div>
      </div>
    </section>

    <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
    <ComfortSettingsPanel group="selection" />
  </div>
</template>
