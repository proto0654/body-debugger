<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  FOCUS_LEVEL_LABELS,
  FOCUS_LEVELS,
  METHOD_LABELS,
  METHODS,
  ZONE_LABELS,
  ZONES
} from '@shared/constants/catalog-axes'
import type { FocusLevel, Method, Zone } from '@shared/types/exercise-v2'
import { PROFILE_SHIFT_MAX_DAYS } from '@shared/constants/catalog-tuning'
import { emptyFocusV2 } from '@shared/domain/focus-v2'
import { poolSnapshot, previewDelta } from '@shared/domain/catalog-sandbox'
import { useCatalogStore } from '@/stores/catalog'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { useSandboxStore } from '@/stores/sandbox'

type Scope = 'permanent' | 'today' | 'days'

const settings = useSettingsStore()
const catalog = useCatalogStore()
const sessions = useSessionsStore()
const sandbox = useSandboxStore()

const scope = ref<Scope>('permanent')
const days = ref(3)
const deltaText = ref('')

const columns: { level: FocusLevel; label: string }[] = [
  { level: 2, label: `${FOCUS_LEVEL_LABELS[2]} Чаще` },
  { level: 1, label: `${FOCUS_LEVEL_LABELS[1]} Больше` },
  { level: 0, label: `${FOCUS_LEVEL_LABELS[0]} Обычно` },
  { level: -1, label: `${FOCUS_LEVEL_LABELS[-1]} Реже` }
]

const focus = computed(() => sandbox.controls?.focus ?? settings.focusV2)

function chipsFor(level: FocusLevel) {
  const zones = ZONES.filter((z) => focus.value.zones[z] === level).map((z) => ({
    axis: 'zone' as const,
    key: z,
    label: ZONE_LABELS[z]
  }))
  const methods = METHODS.filter((m) => focus.value.methods[m] === level).map((m) => ({
    axis: 'method' as const,
    key: m,
    label: METHOD_LABELS[m]
  }))
  return [...zones, ...methods]
}

function endOfTodayIso(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function endInDaysIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + Math.min(PROFILE_SHIFT_MAX_DAYS, Math.max(1, n)))
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

async function moveChip(
  axis: 'zone' | 'method',
  key: string,
  level: FocusLevel
): Promise<void> {
  const beforeInput = sandbox.pickInput
  if (scope.value === 'permanent') {
    if (!sandbox.controls) sandbox.resetFromReal()
    if (axis === 'zone') sandbox.setZoneLevel(key as Zone, level)
    else sandbox.setMethodLevel(key as Method, level)
  } else {
    const until = scope.value === 'today' ? endOfTodayIso() : endInDaysIso(days.value)
    if (level === 0) {
      await settings.setProfileShifts(
        settings.profileShifts.filter((s) => !(s.axis === axis && s.key === key && s.source === 'user'))
      )
    } else {
      await settings.addUserProfileShift({ axis, key, level, until })
    }
  }

  const afterInput = sandbox.pickInput
  if (beforeInput && afterInput) {
    const delta = previewDelta(beforeInput, afterInput, 1)
    const title = (id: string) => catalog.resolved.find((e) => e.id === id)?.title ?? id
    const gain = delta.topGain.map((r) => `${title(r.id)} ↑`).join(', ')
    const lose = delta.topLose.map((r) => `${title(r.id)} ↓`).join(', ')
    deltaText.value = `Что изменится: ${gain || '—'} / ${lose || '—'}`
  } else {
    const base = {
      catalog: catalog.resolved,
      recentSessions: sessions.history,
      settings: settings.asSettings(),
      focus: settings.focusV2,
      profileStrength: settings.profileStrength,
      useShareProfile: true as const
    }
    const afterFocus =
      scope.value === 'permanent'
        ? (sandbox.controls?.focus ?? emptyFocusV2())
        : settings.focusV2
    const delta = previewDelta(base, { ...base, focus: afterFocus }, 1)
    const title = (id: string) => catalog.resolved.find((e) => e.id === id)?.title ?? id
    deltaText.value = `Что изменится: ${delta.topGain.map((r) => title(r.id)).join(', ') || '—'} / ${delta.topLose.map((r) => title(r.id)).join(', ') || '—'}`
  }

  void poolSnapshot
}

async function menuMove(axis: 'zone' | 'method', key: string, level: FocusLevel): Promise<void> {
  await moveChip(axis, key, level)
}
</script>

<template>
  <section class="space-y-3" data-testid="preference-board" aria-live="polite">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-slate-500">Срок</span>
      <button
        type="button"
        class="setting-chip text-[11px]"
        :class="scope === 'permanent' ? 'ring-1 ring-emerald-500' : ''"
        @click="scope = 'permanent'"
      >
        Постоянно
      </button>
      <button
        type="button"
        class="setting-chip text-[11px]"
        :class="scope === 'today' ? 'ring-1 ring-emerald-500' : ''"
        @click="scope = 'today'"
      >
        На сегодня
      </button>
      <button
        type="button"
        class="setting-chip text-[11px]"
        :class="scope === 'days' ? 'ring-1 ring-emerald-500' : ''"
        @click="scope = 'days'"
      >
        На N дней
      </button>
      <input
        v-if="scope === 'days'"
        v-model.number="days"
        type="number"
        min="1"
        :max="PROFILE_SHIFT_MAX_DAYS"
        class="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1"
      />
    </div>

    <div class="grid gap-2 md:grid-cols-4">
      <div
        v-for="col in columns"
        :key="col.level"
        class="rounded border border-slate-800 bg-slate-950/40 p-2"
      >
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ col.label }}</p>
        <div class="flex flex-wrap gap-1">
          <div v-for="chip in chipsFor(col.level)" :key="`${chip.axis}-${chip.key}`" class="relative">
            <button type="button" class="setting-chip text-[11px]">{{ chip.label }}</button>
            <details class="absolute right-0 top-0">
              <summary class="sr-only">Переместить {{ chip.label }}</summary>
              <div class="absolute z-10 mt-6 w-28 rounded border border-slate-700 bg-slate-950 p-1 shadow-lg">
                <button
                  v-for="level in FOCUS_LEVELS"
                  :key="level"
                  type="button"
                  class="block w-full px-2 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800"
                  @click="menuMove(chip.axis, chip.key, level)"
                >
                  → {{ FOCUS_LEVEL_LABELS[level] }}
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>

    <p v-if="deltaText" class="text-xs text-emerald-300/90">{{ deltaText }}</p>
    <p class="text-[11px] text-slate-500">
      Активные сдвиги:
      <span v-if="settings.profileShifts.length === 0">нет</span>
      <span v-for="shift in settings.profileShifts" :key="`${shift.axis}-${shift.key}-${shift.until}`" class="mr-2">
        {{ shift.axis }}:{{ shift.key }}={{ shift.level }} ({{ shift.source }})
      </span>
    </p>
  </section>
</template>
