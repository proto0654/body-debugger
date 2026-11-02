<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  FOCUS_LEVEL_LABELS,
  FOCUS_LEVELS,
  METHOD_LABELS,
  METHODS,
  ZONE_LABELS,
  ZONES
} from '@shared/constants/catalog-axes'
import { EFFECTIVE_POOL_WARN_THRESHOLD } from '@shared/constants/field-docs'
import { PICKER_MODE_LABELS } from '@shared/domain/preferences'
import type { ExercisePickerMode } from '@shared/types/settings'
import type { FocusLevel, Method, Zone } from '@shared/types/exercise-v2'
import FactorChips from '@/components/catalog/FactorChips.vue'
import PreferenceBoard from '@/components/catalog/PreferenceBoard.vue'
import ManualEditPanel from '@/components/catalog/ManualEditPanel.vue'
import ExerciseDrawer from '@/components/catalog/ExerciseDrawer.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useSandboxStore } from '@/stores/sandbox'
import { useSessionsStore } from '@/stores/sessions'

const catalog = useCatalogStore()
const sandbox = useSandboxStore()
const sessions = useSessionsStore()
const applyCount = ref(0)
const selectedId = ref<string | null>(null)

onMounted(() => {
  if (!sandbox.controls) sandbox.resetFromReal()
})

const ranked = computed(() => {
  const snap = sandbox.snapshot
  if (!snap) return []
  return [...snap.candidates].sort((a, b) => {
    if (!!a.filteredBy !== !!b.filteredBy) return a.filteredBy ? 1 : -1
    return b.probability - a.probability
  })
})

const selectedExercise = computed(() =>
  selectedId.value ? catalog.resolved.find((ex) => ex.id === selectedId.value) : undefined
)

const titleOf = (id: string) => catalog.resolved.find((ex) => ex.id === id)?.title ?? id

async function apply(): Promise<void> {
  applyCount.value = await sandbox.applyToSettings()
}

function takeRealHistory(): void {
  sandbox.virtualHistory = sessions.history.slice(0, 5)
}
</script>

<template>
  <section class="space-y-4" data-testid="catalog-sandbox">
    <div class="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      Песочница — настройки приложения не меняются
    </div>

    <ManualEditPanel v-if="catalog.editExerciseId" />

    <div v-else class="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside v-if="sandbox.controls" class="settings-card space-y-3 text-xs">
        <h2 class="text-sm font-semibold text-white">Управление</h2>
        <label class="block">
          Интервал (мин)
          <input
            v-model.number="sandbox.controls.intervalMinutes"
            type="number"
            min="5"
            max="240"
            class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
          />
        </label>
        <label class="block">
          Режим пикера
          <select
            v-model="sandbox.controls.pickerMode"
            class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
          >
            <option v-for="(label, mode) in PICKER_MODE_LABELS" :key="mode" :value="mode as ExercisePickerMode">
              {{ label }}
            </option>
          </select>
        </label>
        <label class="block">
          λ {{ sandbox.controls.profileStrength.toFixed(2) }}
          <input
            v-model.number="sandbox.controls.profileStrength"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="w-full accent-emerald-500"
          />
        </label>

        <div>
          <p class="mb-1 text-slate-500">Зоны</p>
          <div v-for="zone in ZONES" :key="zone" class="mb-1 flex items-center justify-between gap-2">
            <span>{{ ZONE_LABELS[zone] }}</span>
            <select
              class="rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
              :value="sandbox.controls.focus.zones[zone]"
              @change="sandbox.setZoneLevel(zone, Number(($event.target as HTMLSelectElement).value) as FocusLevel)"
            >
              <option v-for="level in FOCUS_LEVELS" :key="level" :value="level">
                {{ FOCUS_LEVEL_LABELS[level] }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <p class="mb-1 text-slate-500">Методы</p>
          <div v-for="method in METHODS" :key="method" class="mb-1 flex items-center justify-between gap-2">
            <span class="truncate">{{ METHOD_LABELS[method] }}</span>
            <select
              class="rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
              :value="sandbox.controls.focus.methods[method]"
              @change="sandbox.setMethodLevel(method, Number(($event.target as HTMLSelectElement).value) as FocusLevel)"
            >
              <option v-for="level in FOCUS_LEVELS" :key="level" :value="level">
                {{ FOCUS_LEVEL_LABELS[level] }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="setting-chip text-[11px]" @click="sandbox.resetFromReal()">Сбросить</button>
          <button type="button" class="setting-chip text-[11px]" @click="sandbox.pinBaseline()">Зафиксировать как A</button>
          <button type="button" class="setting-chip text-[11px]" @click="apply">
            Применить к настройкам
            <span v-if="applyCount"> ({{ applyCount }})</span>
          </button>
          <button type="button" class="setting-chip text-[11px]" @click="takeRealHistory()">Взять последние 5 реальных</button>
        </div>
      </aside>

      <div class="space-y-3">
        <div class="flex flex-wrap gap-1 text-xs">
          <button
            v-for="tab in [
              ['pool', 'Пул'],
              ['combo', 'Матрица'],
              ['sim', 'Симуляция'],
              ['week', 'Неделя'],
              ['ab', 'Что если'],
              ['prefs', 'Предпочтения']
            ] as const"
            :key="tab[0]"
            type="button"
            class="setting-chip text-[11px]"
            :class="sandbox.resultTab === tab[0] ? 'ring-1 ring-emerald-500' : ''"
            @click="sandbox.resultTab = tab[0]"
          >
            {{ tab[1] }}
          </button>
        </div>

        <div v-if="sandbox.resultTab === 'pool' && sandbox.snapshot" class="settings-card space-y-3">
          <div class="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>eligible {{ sandbox.snapshot.eligibleCount }}</span>
            <span>effective {{ sandbox.snapshot.effectiveSize.toFixed(1) }}</span>
            <span>top-3 mass {{ (sandbox.snapshot.topMass * 100).toFixed(0) }}%</span>
          </div>
          <p
            v-if="sandbox.snapshot.thin"
            class="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200"
          >
            Пул узкий (&lt; {{ EFFECTIVE_POOL_WARN_THRESHOLD }}).
            <button type="button" class="underline" @click="catalog.section = 'ai'">сгенерировать</button>
          </p>
          <ul class="space-y-1">
            <li v-for="row in ranked" :key="row.id">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-slate-900"
                :class="row.filteredBy ? 'text-slate-500' : 'text-slate-200'"
                @click="selectedId = row.id"
              >
                <span class="w-40 truncate">{{ titleOf(row.id) }}</span>
                <div class="h-1.5 flex-1 rounded bg-slate-800">
                  <div
                    class="h-full rounded"
                    :class="row.filteredBy ? 'bg-slate-600' : 'bg-emerald-500/80'"
                    :style="{ width: `${Math.min(100, row.probability * 100)}%` }"
                  />
                </div>
                <span class="w-14 text-right">
                  {{ row.filteredBy ? row.filteredBy : `${(row.probability * 100).toFixed(1)}%` }}
                </span>
              </button>
              <FactorChips v-if="!row.filteredBy && row.factors.length" class="ml-2" :factors="row.factors" />
              <p v-if="sandbox.deltaVsBaseline" class="ml-2 text-[10px] text-slate-500">
                <template v-for="d in sandbox.deltaVsBaseline.moved.filter((m) => m.id === row.id)" :key="d.id">
                  {{ d.delta > 0 ? '↑' : '↓' }}{{ (Math.abs(d.delta) * 100).toFixed(1) }}
                </template>
              </p>
            </li>
          </ul>
        </div>

        <div v-else-if="sandbox.resultTab === 'combo'" class="settings-card overflow-x-auto">
          <table class="w-full min-w-[640px] border-collapse text-[11px]">
            <thead>
              <tr>
                <th class="border border-slate-800 p-1 text-slate-500" />
                <th v-for="method in METHODS" :key="method" class="border border-slate-800 p-1 text-slate-400">
                  {{ METHOD_LABELS[method] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="zone in ZONES" :key="zone">
                <th class="border border-slate-800 p-1 text-left text-slate-300">{{ ZONE_LABELS[zone] }}</th>
                <td
                  v-for="method in METHODS"
                  :key="method"
                  class="cursor-pointer border border-slate-800 p-1 align-top hover:bg-slate-900"
                  :class="sandbox.combo.find((c) => c.zone === zone && c.method === method)?.dead ? 'bg-slate-950 text-slate-500' : ''"
                  @click="sandbox.loadCombo(zone as Zone, method as Method); sandbox.resultTab = 'pool'"
                >
                  <template v-if="sandbox.combo.find((c) => c.zone === zone && c.method === method)">
                    <p v-if="sandbox.combo.find((c) => c.zone === zone && c.method === method)!.dead">
                      подходящих 0
                      <button type="button" class="underline" @click.stop="catalog.openAiForCell({ zone, method })">
                        сгенерировать
                      </button>
                    </p>
                    <template v-else>
                      <p
                        v-for="item in sandbox.combo.find((c) => c.zone === zone && c.method === method)!.top3"
                        :key="item.id"
                      >
                        {{ titleOf(item.id) }}
                      </p>
                      <p class="text-slate-500">
                        eff {{ sandbox.combo.find((c) => c.zone === zone && c.method === method)!.effectiveSize.toFixed(1) }}
                      </p>
                    </template>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="sandbox.resultTab === 'sim' && sandbox.simulation" class="settings-card space-y-3 text-xs">
          <div class="flex flex-wrap gap-2">
            <label>
              N
              <input v-model.number="sandbox.simN" type="number" min="10" max="2000" class="ml-1 w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1" />
            </label>
            <label>
              seed
              <input v-model.number="sandbox.simSeed" type="number" class="ml-1 w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1" />
            </label>
          </div>
          <p>
            unique {{ sandbox.simulation.uniqueCount }} · longest zone streak
            {{ sandbox.simulation.longestSameZoneStreak }} · repeat≤3
            {{ (sandbox.simulation.repeatWithin3Rate * 100).toFixed(0) }}%
          </p>
          <ul>
            <li v-for="zone in ZONES" :key="zone">
              {{ ZONE_LABELS[zone] }} · {{ Math.round(sandbox.simulation.zoneShares[zone] * 100) }}%
            </li>
          </ul>
          <ul>
            <li v-for="method in METHODS" :key="method">
              {{ METHOD_LABELS[method] }} · {{ Math.round(sandbox.simulation.methodShares[method] * 100) }}%
            </li>
          </ul>
        </div>

        <div v-else-if="sandbox.resultTab === 'week' && sandbox.week" class="settings-card space-y-3 text-xs">
          <div v-for="day in sandbox.week.days" :key="day.day" class="flex items-center gap-2">
            <span class="w-12 text-slate-500">День {{ day.day + 1 }}</span>
            <div class="flex flex-1 gap-0.5">
              <span
                v-for="(zone, i) in day.zones"
                :key="i"
                class="h-4 flex-1 rounded"
                :class="{
                  'bg-sky-500/80': zone === 'upper',
                  'bg-amber-500/80': zone === 'core',
                  'bg-violet-500/80': zone === 'lower',
                  'bg-emerald-500/80': zone === 'full'
                }"
                :title="ZONE_LABELS[zone]"
              />
            </div>
          </div>
        </div>

        <div v-else-if="sandbox.resultTab === 'ab'" class="settings-card space-y-2 text-xs">
          <p v-if="!sandbox.baseline" class="text-slate-500">Сначала «Зафиксировать как A».</p>
          <template v-else-if="sandbox.deltaVsBaseline">
            <p class="text-emerald-300">
              Выросли: {{ sandbox.deltaVsBaseline.topGain.map((r) => titleOf(r.id)).join(', ') || '—' }}
            </p>
            <p class="text-amber-300">
              Упали: {{ sandbox.deltaVsBaseline.topLose.map((r) => titleOf(r.id)).join(', ') || '—' }}
            </p>
            <p class="text-slate-500">
              появились {{ sandbox.deltaVsBaseline.gained.length }} · исчезли
              {{ sandbox.deltaVsBaseline.lost.length }} · сдвинулись {{ sandbox.deltaVsBaseline.moved.length }}
            </p>
          </template>
        </div>

        <PreferenceBoard v-else-if="sandbox.resultTab === 'prefs'" />
      </div>
    </div>

    <div v-if="selectedExercise && sandbox.pickInput" class="mt-4 max-w-md">
      <ExerciseDrawer
        :exercise="selectedExercise"
        :pick-input="sandbox.pickInput"
        readonly
        @close="selectedId = null"
        @how-it-works="catalog.section = 'library'"
      />
    </div>
  </section>
</template>
