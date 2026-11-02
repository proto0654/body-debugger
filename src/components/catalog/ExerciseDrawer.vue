<script setup lang="ts">
import { computed, ref } from 'vue'
import { METHOD_LABELS, ZONE_LABELS, LIMITATION_LABELS } from '@shared/constants/catalog-axes'
import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import { intensityCap } from '@shared/domain/dose'
import { characterBranch, BRANCH_LABELS } from '@shared/domain/character-branch'
import type { ExerciseV2Resolved } from '@shared/types/exercise-v2'
import type { PickCandidate, PickInput } from '@shared/domain/picker'
import { explainPick } from '@shared/domain/picker'
import FieldHelp from '@/components/catalog/FieldHelp.vue'
import ZoneBar from '@/components/catalog/ZoneBar.vue'
import DoseScale from '@/components/catalog/DoseScale.vue'
import FactorChips from '@/components/catalog/FactorChips.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  exercise: ExerciseV2Resolved
  pickInput?: PickInput
  readonly?: boolean
}>()

const emit = defineEmits<{
  close: []
  edit: []
  archive: []
  pin: []
  excludeToday: []
  howItWorks: []
}>()

const catalog = useCatalogStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()

const input = computed<PickInput>(
  () =>
    props.pickInput ?? {
      catalog: catalog.resolved,
      recentSessions: sessions.history,
      settings: settings.asSettings(),
      focus: settings.focusV2,
      profileStrength: settings.profileStrength,
      overrides: settings.overrides,
      limitations: settings.limitations,
      useShareProfile: true
    }
)

const explanation = computed(() => explainPick(input.value, 1))
const candidate = computed(
  () => explanation.value.candidates.find((c) => c.id === props.exercise.id) as PickCandidate | undefined
)

const branch = computed(() => characterBranch(props.exercise.dominantZone, props.exercise.method))
const scale = computed(() => settings.overrides[props.exercise.id]?.scale ?? 1)

const batchName = computed(() => {
  const id = props.exercise.source.batchId
  return id ? catalog.batches.find((b) => b.id === id)?.name : undefined
})

const sameCell = computed(() =>
  catalog.resolved.filter(
    (ex) =>
      ex.id !== props.exercise.id &&
      ex.dominantZone === props.exercise.dominantZone &&
      ex.method === props.exercise.method &&
      ex.status === 'active'
  )
)

const mods = computed(() => {
  const harder = catalog.resolved.filter((ex) => ex.modificationOf === props.exercise.id)
  const easier = props.exercise.modificationOf
    ? catalog.resolved.find((ex) => ex.id === props.exercise.modificationOf)
    : undefined
  return { harder, easier }
})

const history = computed(() => {
  const rows = sessions.history.filter((s) => s.exerciseId === props.exercise.id)
  const shown = rows.length
  const done = rows.filter((s) => s.status === 'done').length
  const skips = rows.filter((s) => s.status === 'skipped' || s.status === 'missed').length
  const last = rows[0]
  return { shown, done, skips, last }
})

const hints = computed(() => catalog.hints.filter((h) => h.exerciseId === props.exercise.id))

const availability = computed(() => {
  const ex = props.exercise
  const inv = settings.asSettings().inventory
  const need = ex.equipment ?? []
  const hasEquipment =
    need.length === 0 || (inv.enabled && need.every((id) => inv.items.includes(id)))
  const cap = intensityCap(settings.intervalMinutes)
  const limitations = settings.limitations
  const avoidHit = (ex.avoidIf ?? []).some((tag) => limitations.includes(tag))
  const batch = ex.source.batchId
    ? catalog.batches.find((b) => b.id === ex.source.batchId)
    : undefined
  return [
    {
      label: 'Инвентарь',
      ok: hasEquipment,
      reason: hasEquipment ? 'ок' : need.map((id) => EQUIPMENT_CATALOG.find((e) => e.id === id)?.title ?? id).join(', ')
    },
    {
      label: 'Интенсивность',
      ok: ex.intensity <= cap,
      reason: `${ex.intensity} ≤ потолок ${cap}`
    },
    {
      label: 'Ограничения',
      ok: !avoidHit,
      reason: avoidHit
        ? (ex.avoidIf ?? []).map((t) => LIMITATION_LABELS[t]).join(', ')
        : 'нет пересечений'
    },
    {
      label: 'Статус',
      ok: ex.status === 'active',
      reason: ex.status
    },
    {
      label: 'Набор',
      ok: !batch || batch.enabled !== false,
      reason: batch ? `${batch.name}: ${batch.enabled === false ? 'выкл' : 'вкл'}` : 'shipped'
    }
  ]
})

const numberRows = computed(() => [
  { key: 'zones', value: ZONES_FMT(props.exercise.zones) },
  { key: 'method', value: METHOD_LABELS[props.exercise.method] },
  { key: 'intensity', value: String(props.exercise.intensity) },
  { key: 'difficulty', value: String(props.exercise.difficulty) },
  {
    key: 'timer.minSec',
    value: `${props.exercise.timer.minSec} / ${props.exercise.timer.defaultSec} / ${props.exercise.timer.maxSec}`
  },
  { key: 'timer.perSide', value: props.exercise.timer.perSide ? 'да' : 'нет' },
  {
    key: 'reps',
    value: props.exercise.reps ? `${props.exercise.reps.min}–${props.exercise.reps.max}` : '—'
  },
  {
    key: 'equipment',
    value:
      (props.exercise.equipment ?? [])
        .map((id) => EQUIPMENT_CATALOG.find((e) => e.id === id)?.title ?? id)
        .join(', ') || '—'
  },
  {
    key: 'context',
    value: `${props.exercise.context.posture}${props.exercise.context.quiet ? ', quiet' : ''}${props.exercise.context.noSweat ? ', no-sweat' : ''}`
  },
  {
    key: 'avoidIf',
    value: (props.exercise.avoidIf ?? []).map((t) => LIMITATION_LABELS[t]).join(', ') || '—'
  },
  { key: 'status', value: props.exercise.status },
  {
    key: 'source',
    value: `${props.exercise.source.kind}${props.exercise.source.model ? ` · ${props.exercise.source.model}` : ''}`
  }
])

function ZONES_FMT(zones: ExerciseV2Resolved['zones']): string {
  return Object.entries(zones)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${ZONE_LABELS[k as keyof typeof ZONE_LABELS]} ${Math.round((v ?? 0) * 100)}%`)
    .join(', ')
}

const mathOpen = ref(false)
</script>

<template>
  <aside class="flex h-full flex-col border-l border-slate-800 bg-slate-950/80" data-testid="exercise-drawer">
    <div class="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
      <div>
        <p class="text-lg" aria-hidden="true">{{ exercise.emojiFallback }}</p>
        <h2 class="text-sm font-semibold text-white">{{ exercise.title }}</h2>
        <p class="mt-1 text-xs text-slate-400">{{ exercise.description }}</p>
        <p class="mt-2 text-[11px] text-slate-500">
          {{ exercise.source.kind }}
          <template v-if="batchName"> · {{ batchName }}</template>
          <template v-if="exercise.source.model"> · {{ exercise.source.model }}</template>
          · {{ exercise.status }}
        </p>
      </div>
      <button type="button" class="setting-chip text-[11px]" @click="emit('close')">Закрыть</button>
    </div>

    <div class="flex-1 space-y-5 overflow-y-auto px-4 py-4 text-xs">
      <section>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="font-semibold text-slate-200">Числа</h3>
          <button type="button" class="text-[11px] text-emerald-400" @click="emit('howItWorks')">Как это работает</button>
        </div>
        <table class="w-full border-collapse">
          <tbody>
            <tr v-for="row in numberRows" :key="row.key" class="border-b border-slate-900">
              <th class="py-1.5 pr-2 text-left font-medium text-slate-400">
                {{ row.key }}
                <FieldHelp :field-key="row.key === 'timer.minSec' ? 'timer.minSec' : row.key" />
              </th>
              <td class="py-1.5 text-slate-200">{{ row.value }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 class="mb-2 font-semibold text-slate-200">Профиль нагрузки</h3>
        <ZoneBar :zones="exercise.zones" />
        <p class="mt-2 text-slate-400">
          {{ METHOD_LABELS[exercise.method] }} · ветка персонажа:
          {{ branch ? BRANCH_LABELS[branch] : '—' }}
        </p>
      </section>

      <DoseScale
        :timer="exercise.timer"
        :intensity="exercise.intensity"
        :interval-minutes="settings.intervalMinutes"
        :scale="scale"
      />

      <section>
        <h3 class="mb-2 font-semibold text-slate-200">Доступность</h3>
        <ul class="space-y-1">
          <li v-for="item in availability" :key="item.label" class="flex gap-2">
            <span :class="item.ok ? 'text-emerald-400' : 'text-amber-300'">{{ item.ok ? '✓' : '✗' }}</span>
            <span class="text-slate-300">{{ item.label }} — {{ item.reason }}</span>
          </li>
        </ul>
      </section>

      <section>
        <h3 class="mb-2 font-semibold text-slate-200">Вероятность сейчас</h3>
        <p v-if="candidate?.filteredBy" class="text-amber-300">Отфильтровано: {{ candidate.filteredBy }}</p>
        <template v-else-if="candidate">
          <p class="text-emerald-300">{{ (candidate.probability * 100).toFixed(2) }}%</p>
          <FactorChips class="mt-2" :factors="candidate.factors" />
          <button type="button" class="mt-2 text-[11px] text-slate-400 underline" @click="mathOpen = !mathOpen">
            {{ mathOpen ? 'скрыть расчёт' : 'показать расчёт' }}
          </button>
          <p v-if="mathOpen" class="mt-1 font-mono text-[10px] text-slate-500">
            weight =
            <template v-for="(f, i) in candidate.factors" :key="f.key">
              {{ i ? ' × ' : '' }}{{ f.mult.toFixed(3) }}
            </template>
            → p = {{ candidate.probability.toFixed(4) }}
          </p>
        </template>
        <p v-else class="text-slate-500">Нет данных для расчёта</p>
      </section>

      <section>
        <h3 class="mb-2 font-semibold text-slate-200">История</h3>
        <p class="text-slate-400">
          показов {{ history.shown }} · сделано {{ history.done }} · пропусков {{ history.skips }}
          <template v-if="history.last">
            · последнее {{ history.last.completedAt ?? history.last.triggeredAt }}
          </template>
          <template v-else> · ещё не показывалось</template>
        </p>
        <ul v-if="hints.length" class="mt-2 space-y-1 text-amber-300">
          <li v-for="hint in hints" :key="hint.kind">{{ hint.kind }}</li>
        </ul>
      </section>

      <section>
        <h3 class="mb-2 font-semibold text-slate-200">Связи</h3>
        <p v-if="mods.easier" class="text-slate-400">Проще: {{ mods.easier.title }}</p>
        <p v-if="mods.harder.length" class="text-slate-400">
          Сложнее: {{ mods.harder.map((e) => e.title).join(', ') }}
        </p>
        <p class="mt-1 text-slate-500">
          В ячейке {{ ZONE_LABELS[exercise.dominantZone] }} × {{ METHOD_LABELS[exercise.method] }}:
          {{ sameCell.length }} ещё
        </p>
      </section>

      <section v-if="!readonly" class="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        <button type="button" class="setting-chip text-[11px]" @click="emit('edit')">Изменить</button>
        <button type="button" class="setting-chip text-[11px]" @click="emit('archive')">В архив</button>
        <button type="button" class="setting-chip text-[11px]" @click="emit('pin')">Закрепить на следующий</button>
        <button type="button" class="setting-chip text-[11px]" @click="emit('excludeToday')">Не показывать сегодня</button>
      </section>
    </div>
  </aside>
</template>
