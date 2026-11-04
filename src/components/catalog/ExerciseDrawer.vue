<script setup lang="ts">
import { computed, watch } from 'vue'
import { METHOD_LABELS, ZONE_LABELS, LIMITATION_LABELS } from '@shared/constants/catalog-axes'
import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import { plannedExerciseSeconds } from '@shared/domain/exercise-start'
import { explainPick, type PickInput } from '@shared/domain/picker'
import type { ExerciseV2Resolved } from '@shared/types/exercise-v2'
import { useCatalogStore } from '@/stores/catalog'
import { useSettingsStore } from '@/stores/settings'
import { useSessionsStore } from '@/stores/sessions'
import { useExerciseStartStore } from '@/stores/exercise-start'
import FactorChips from './FactorChips.vue'
import DoseScale from './DoseScale.vue'
import ZoneBar from './ZoneBar.vue'
const props = defineProps<{ exercise: ExerciseV2Resolved; pickInput?: PickInput; readonly?: boolean }>()
const emit = defineEmits<{ close: []; edit: []; archive: []; pin: []; excludeToday: []; howItWorks: [] }>()
const catalog = useCatalogStore()
const settings = useSettingsStore()
const sessions = useSessionsStore()
const start = useExerciseStartStore()
const reason = computed(() => catalog.unavailableReason(props.exercise.id))
const seconds = computed(() => plannedExerciseSeconds(props.exercise, settings.asSettings()))
const equipment = computed(() => props.exercise.equipment?.map(id => EQUIPMENT_CATALOG.find(item => item.id === id)?.title ?? id).join(', ') || 'Не нужен')
const history = computed(() => sessions.history.filter(session => session.exerciseId === props.exercise.id))
const limitationText = computed(() => props.exercise.avoidIf?.map(tag => LIMITATION_LABELS[tag]).join(', ') || 'Нет')
const candidate = computed(() => props.pickInput ? explainPick(props.pickInput, 1).candidates.find(item => item.id === props.exercise.id) : undefined)
watch(() => props.exercise.id, () => { start.error = '' })
</script>
<template>
  <aside class="exercise-preview settings-card space-y-5" data-testid="exercise-drawer">
    <div class="flex items-start justify-between gap-3"><div><p class="text-sm text-emerald-400">{{ ZONE_LABELS[exercise.dominantZone] }} · {{ METHOD_LABELS[exercise.method] }}</p><h2 class="mt-2 text-xl font-semibold text-white">{{ exercise.title }}</h2></div><button type="button" class="setting-chip" @click="emit('close')">← К списку</button></div>
    <section class="exercise-instruction"><h3 class="text-sm font-semibold text-white">Как выполнять</h3><p class="mt-3 text-base leading-relaxed text-slate-200">{{ exercise.description }}</p></section>
    <dl class="grid grid-cols-2 gap-4 text-sm"><div><dt class="text-slate-400">Длительность</dt><dd class="mt-1 text-lg text-white">{{ seconds }} с</dd></div><div><dt class="text-slate-400">Инвентарь</dt><dd class="mt-1 text-slate-200">{{ equipment }}</dd></div><div><dt class="text-slate-400">Положение</dt><dd class="mt-1">{{ { seated: 'Сидя', standing: 'Стоя', floor: 'На полу' }[exercise.context.posture] }}</dd></div><div><dt class="text-slate-400">Условия</dt><dd class="mt-1">{{ [exercise.context.quiet ? 'Тихо' : 'Возможен шум', exercise.context.noSweat ? 'Без пота' : 'Активная нагрузка'].join(' · ') }}</dd></div></dl>
    <p v-if="reason" class="text-sm text-amber-300">{{ reason }}</p>
    <div v-if="!readonly" class="flex flex-wrap gap-3"><button type="button" class="primary-action" :disabled="!!reason || start.busy" @click="start.start({ source: 'catalog', exerciseId: exercise.id })">Начать · {{ seconds }} с</button><button type="button" class="setting-chip" :disabled="!!reason" @click="emit('pin')">На следующий перерыв</button></div>
    <p v-if="!readonly && start.error" role="alert" class="text-sm text-red-300">{{ start.error }}</p>
    <details><summary>Почему в подборе</summary><p class="mt-3 text-sm text-slate-300">{{ reason || 'Подходит вашим текущим настройкам. Частота зависит от недавних разминок и приоритетов.' }}</p><FactorChips v-if="candidate" class="mt-2" :factors="candidate.factors" /></details>
    <details><summary>История упражнения · {{ history.length }}</summary><p class="mt-3 text-sm text-slate-400">Выполнено: {{ history.filter(session => session.status === 'done').length }}</p><p v-if="history[0]" class="text-xs text-slate-400">Последний показ: {{ new Date(history[0].triggeredAt).toLocaleString('ru-RU') }}</p></details>
    <details><summary>Технические параметры</summary><div class="mt-4 space-y-3 text-xs"><ZoneBar :zones="exercise.zones" /><DoseScale :timer="exercise.timer" :intensity="exercise.intensity" :interval-minutes="settings.intervalMinutes" :scale="settings.overrides[exercise.id]?.scale ?? 1" /><p>Ограничения: {{ limitationText }}</p><p>Источник: {{ exercise.source.kind }} · {{ exercise.source.model }} · {{ exercise.status }}</p><p v-if="candidate">Шанс сейчас: {{ (candidate.probability * 100).toFixed(1) }}%</p><button type="button" class="setting-chip" @click="emit('howItWorks')">Как работает подбор</button></div></details>
    <details v-if="!readonly"><summary>Другие действия</summary><div class="mt-3 flex flex-wrap gap-2"><button type="button" class="setting-chip" @click="emit('edit')">Изменить</button><button type="button" class="setting-chip" @click="emit('archive')">В архив</button><button type="button" class="setting-chip" @click="emit('excludeToday')">Не показывать сегодня</button></div></details>
  </aside>
</template>
