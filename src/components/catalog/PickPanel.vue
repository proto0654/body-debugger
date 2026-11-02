<script setup lang="ts">
import { computed } from 'vue'
import { METHOD_LABELS, ZONE_LABELS } from '@shared/constants/catalog-axes'
import { SHARE_WINDOW_DAYS } from '@shared/constants/catalog-tuning'
import { targetVsActual } from '@shared/domain/coverage'
import { explainPick, type PickFactor } from '@shared/domain/picker'
import { PICKER_MODE_LABELS } from '@shared/domain/preferences'
import PickSimulatorBlock from '@/components/catalog/PickSimulatorBlock.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'

const catalog = useCatalogStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()

const pickInput = computed(() => ({
  catalog: catalog.resolved,
  recentSessions: sessions.history,
  settings: settings.asSettings(),
  focus: settings.focusV2,
  profileStrength: settings.profileStrength,
  overrides: settings.overrides,
  limitations: settings.limitations,
  useShareProfile: true
}))

const shares = computed(() =>
  targetVsActual(settings.focusV2, sessions.history, catalog.resolved)
)

const nextExplain = computed(() => explainPick(pickInput.value, 1))

const lastExplain = computed(() => {
  const last = sessions.lastSession
  if (!last) return null
  const index = sessions.history.findIndex((session) => session.id === last.id)
  const prior = index > 0 ? sessions.history.slice(0, index) : []
  return explainPick({ ...pickInput.value, recentSessions: prior }, 1)
})

const nextExercise = computed(() =>
  catalog.resolved.find((exercise) => exercise.id === nextExplain.value.chosenId)
)

const lastExercise = computed(() => {
  const id = sessions.lastSession?.exerciseId
  return id ? catalog.resolved.find((exercise) => exercise.id === id) : undefined
})

const rotationHint = computed(() => {
  if (settings.pickerMode !== 'rotation') return null
  const zone = nextExplain.value.nextRotationZone
  return zone ? `Следующая зона ротации: ${ZONE_LABELS[zone]}` : null
})

const FACTOR_LABELS: Record<PickFactor['key'], string> = {
  prev: 'Повтор зоны',
  today: 'Нагрузка сегодня',
  method: 'Метод',
  neglect: 'Запуск зоны',
  profile: 'Профиль',
  mode: 'Режим'
}

function factorsFor(exerciseId: string, explanation = nextExplain.value) {
  return explanation.candidates.find((candidate) => candidate.id === exerciseId)?.factors ?? []
}
</script>

<template>
  <section class="settings-card space-y-4" data-testid="catalog-pick">
    <div>
      <h2 class="text-sm font-semibold text-white">Цель и факт за {{ SHARE_WINDOW_DAYS }} дней</h2>
      <p class="mt-1 text-xs text-slate-400">
        Полоски сравнивают долю выполненных разминок с весами профиля. Режим:
        {{ PICKER_MODE_LABELS[settings.pickerMode] }}.
      </p>
      <p v-if="rotationHint" class="mt-2 text-xs text-emerald-400">{{ rotationHint }}</p>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Зоны</h3>
        <ul class="mt-3 space-y-3">
          <li v-for="item in shares.zones" :key="item.key">
            <div class="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>{{ ZONE_LABELS[item.key as keyof typeof ZONE_LABELS] }}</span>
              <span class="text-slate-500">{{ Math.round(item.actual * 100) }}% / {{ Math.round(item.target * 100) }}%</span>
            </div>
            <div class="relative mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                class="absolute inset-y-0 left-0 rounded-full bg-slate-600/80"
                :style="{ width: `${Math.min(100, item.target * 100)}%` }"
              />
              <div
                class="absolute inset-y-0 left-0 rounded-full bg-emerald-500/90"
                :style="{ width: `${Math.min(100, item.actual * 100)}%` }"
              />
            </div>
          </li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Методы</h3>
        <ul class="mt-3 space-y-3">
          <li v-for="item in shares.methods" :key="item.key">
            <div class="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>{{ METHOD_LABELS[item.key as keyof typeof METHOD_LABELS] }}</span>
              <span class="text-slate-500">{{ Math.round(item.actual * 100) }}% / {{ Math.round(item.target * 100) }}%</span>
            </div>
            <div class="relative mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                class="absolute inset-y-0 left-0 rounded-full bg-slate-600/80"
                :style="{ width: `${Math.min(100, item.target * 100)}%` }"
              />
              <div
                class="absolute inset-y-0 left-0 rounded-full bg-emerald-500/90"
                :style="{ width: `${Math.min(100, item.actual * 100)}%` }"
              />
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-slate-800 pt-4">
      <PickSimulatorBlock />
    </div>

    <div class="space-y-4 border-t border-slate-800 pt-4">
      <h3 class="text-sm font-semibold text-white">Почему это</h3>

      <article class="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <p class="text-xs text-slate-500">Следующий кандидат (seed 1)</p>
        <p class="mt-1 text-sm font-medium text-white">
          {{ nextExercise?.title ?? nextExplain.chosenId }}
        </p>
        <ul class="mt-2 space-y-1 text-xs text-slate-400">
          <li v-for="factor in factorsFor(nextExplain.chosenId)" :key="factor.key">
            {{ FACTOR_LABELS[factor.key] }} · ×{{ factor.mult.toFixed(2) }}
            <span class="text-slate-600">— {{ factor.note }}</span>
          </li>
        </ul>
      </article>

      <article v-if="lastExercise && lastExplain" class="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <p class="text-xs text-slate-500">Последняя показанная разминка</p>
        <p class="mt-1 text-sm font-medium text-white">{{ lastExercise.title }}</p>
        <ul class="mt-2 space-y-1 text-xs text-slate-400">
          <li v-for="factor in factorsFor(lastExercise.id, lastExplain)" :key="factor.key">
            {{ FACTOR_LABELS[factor.key] }} · ×{{ factor.mult.toFixed(2) }}
            <span class="text-slate-600">— {{ factor.note }}</span>
          </li>
        </ul>
      </article>
      <p v-else class="text-xs text-slate-500">История пуста — факторы последнего выбора появятся после первой разминки.</p>
    </div>
  </section>
</template>
