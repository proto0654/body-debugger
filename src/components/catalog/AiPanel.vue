<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ZONES, ZONE_LABELS, METHODS, METHOD_LABELS } from '@shared/constants/catalog-axes'
import { COVERAGE_THRESHOLD } from '@shared/constants/catalog-tuning'
import { capGenerateCells } from '@shared/domain/llm-prompt'
import { changesetReviewRows } from '@shared/domain/changeset-review'
import type { ChangesetKind } from '@shared/domain/changeset'
import type { Zone, Method } from '@shared/types/exercise-v2'
import { useCatalogStore } from '@/stores/catalog'
import { useSettingsStore } from '@/stores/settings'
import { useDashboardNavigation } from '@/stores/dashboard-navigation'
import { useAiAssistantStore } from '@/stores/ai-assistant'

const catalog = useCatalogStore()
const settings = useSettingsStore()
const navigation = useDashboardNavigation()
const ai = useAiAssistantStore()
const zone = ref<Zone>(catalog.selectedCell?.zone ?? 'upper')
const method = ref<Method>(catalog.selectedCell?.method ?? 'mobility')
const allThinCells = ref(false)
const task = computed<ChangesetKind>({ get: () => navigation.location.task ?? 'generate', set: value => navigation.navigate('exercises', 'ai', { task: value }) })
const connectionReady = computed(() => settings.llm.enabled && (ai.hasKey || settings.llm.baseUrl === 'mock://local'))
const targetSets = computed(() => catalog.batches.filter(batch => batch.kind !== 'shipped'))
const validSelection = computed(() => ai.changeset?.ops.some(record => record.enabled && record.state !== 'rejected') ?? false)
const rows = computed(() => ai.review?.rows ?? (ai.changeset ? changesetReviewRows(ai.changeset, { exercises: catalog.library, profileShifts: [] }, []) .map(row => ({ ...row, fields: row.fields.map(field => ({ ...field, before: 'Не сохранено в истории' })) })) : []))
const taskLabels: Record<ChangesetKind, string> = { generate: 'Добавить варианты упражнений', edit: 'Изменить свой набор', tune: 'Проанализировать прогресс', retag: 'Переразметить набор' }
const stateLabels: Record<string, string> = { requested: 'Подготовка', generating: 'Запрос выполняется', parsed: 'Проверка ответа', awaiting_approval: 'Черновик · ещё не применён', applied: 'Применено', reverted: 'Применение отменено', discarded: 'Отклонено', failed: 'Ошибка запроса' }
let unsubscribe: (() => void) | undefined

watch(() => [task.value, zone.value, method.value, allThinCells.value, ai.instruction, ai.targetSetId], () => ai.invalidatePreview())
onMounted(() => {
  void ai.execute(async () => {
    const config = await window.api.getLlmConfig()
    settings.llm = config.llm
    ai.hasKey = config.hasKey
    await ai.refreshHistory()
    if (!ai.changeset) ai.changeset = ai.history.find(entry => entry.status === 'awaiting_approval') ?? null
    else ai.changeset = await window.api.getLlmChangeset(ai.changeset.id)
    await ai.refreshReview()
  })
  unsubscribe = window.api?.onLlmChanged?.(payload => {
    if (ai.changeset && payload.changeset.id !== ai.changeset.id && !ai.busy) return
    ai.changeset = payload.changeset
    void ai.refreshReview().catch(() => { ai.review = null; ai.error = 'Не удалось обновить сравнение. Откройте черновик ещё раз.' })
  })
})
onBeforeUnmount(() => unsubscribe?.())
async function prepare(): Promise<void> {
  const kind = task.value
  if (kind === 'tune' && !settings.llm.shareProgress) { ai.error = 'Сначала разрешите отправку агрегатов прогресса.'; return }
  if ((kind === 'edit' || kind === 'retag') && !ai.instruction.trim()) { ai.error = 'Опишите желаемое изменение.'; return }
  if (kind === 'generate') {
    const cells = allThinCells.value
      ? catalog.coverage.filter(cell => cell.belowThreshold).map(cell => ({ zone: cell.zone, method: cell.method, count: Math.max(1, COVERAGE_THRESHOLD - cell.count) }))
      : [{ zone: zone.value, method: method.value, count: 3 }]
    if (!cells.length) { ai.error = 'Для выбранного запроса нет незаполненных направлений.'; return }
    await ai.prepare({ kind, targetSetId: ai.targetSetId, cells: capGenerateCells(cells) })
  } else await ai.prepare({ kind, targetSetId: ai.targetSetId, instruction: ai.instruction.trim() || undefined })
}
async function shareProgress(enabled: boolean): Promise<void> {
  await ai.execute(async () => { await settings.setLlmConfig({ shareProgress: enabled }); ai.invalidatePreview() })
}
</script>

<template>
  <section class="space-y-5" data-testid="catalog-ai">
    <div><h2 class="text-xl font-semibold text-white">ИИ-помощник</h2><p class="mt-2 text-sm text-slate-400">Предложения сначала становятся черновиками. Ты выбираешь, что применить.</p></div>
    <div v-if="!connectionReady" class="settings-card space-y-3"><p>Подключите сервис, чтобы получать предложения. Каталог и обычные разминки доступны без ИИ.</p><button type="button" class="setting-chip" @click="navigation.navigate('settings', 'ai')">Настроить подключение →</button></div>
    <fieldset :disabled="ai.busy" class="settings-card space-y-4">
      <label class="block text-sm">Чем помочь?<select v-model="task" class="profile-select mt-2 w-full"><option value="generate">Добавить варианты упражнений</option><option value="edit">Изменить свой набор</option><option value="tune">Проанализировать прогресс</option><option v-if="task === 'retag'" value="retag">Техническая переразметка</option></select></label>
      <div v-if="task === 'generate'" class="space-y-3"><div class="grid grid-cols-2 gap-3"><label class="text-sm">Зона<select v-model="zone" class="profile-select mt-1 w-full" :disabled="allThinCells"><option v-for="item in ZONES" :key="item" :value="item">{{ ZONE_LABELS[item] }}</option></select></label><label class="text-sm">Направление<select v-model="method" class="profile-select mt-1 w-full" :disabled="allThinCells"><option v-for="item in METHODS" :key="item" :value="item">{{ METHOD_LABELS[item] }}</option></select></label></div><label class="flex items-center gap-2 text-sm"><input v-model="allThinCells" type="checkbox">Дополнить все направления, где мало вариантов</label></div>
      <label v-if="task === 'edit' || task === 'retag'" class="block text-sm">Что изменить?<textarea v-model="ai.instruction" rows="3" class="profile-select mt-2 w-full" placeholder="Например: уточни инструкции в моём наборе"></textarea></label>
      <div v-if="task === 'tune'" class="space-y-3 text-sm"><p class="text-slate-300">Для анализа нужны агрегаты выполнения упражнений. Вес, фотографии и личные ограничения не отправляются.</p><label class="flex items-center gap-2"><input type="checkbox" :checked="settings.llm.shareProgress" @change="shareProgress(($event.target as HTMLInputElement).checked)">Разрешить отправку агрегатов прогресса</label></div>
      <label class="block text-sm">Сохранить предложения в набор<select v-model="ai.targetSetId" class="profile-select mt-2 w-full"><option v-for="batch in targetSets" :key="batch.id" :value="batch.id">{{ batch.name }}</option></select></label>
      <button type="button" class="primary-action" :disabled="!connectionReady || !targetSets.length || (task === 'tune' && !settings.llm.shareProgress)" @click="prepare">Проверить запрос</button>
      <details><summary>Дополнительные инструменты</summary><button type="button" class="setting-chip mt-3" @click="task = 'retag'">Переразметить свой набор</button></details>
    </fieldset>
    <section v-if="ai.preview" class="settings-card space-y-4" data-testid="ai-request-preview">
      <h3 class="font-semibold">Проверка перед отправкой</h3><p class="text-sm">{{ taskLabels[ai.preparedInput!.kind] }} · {{ targetSets.find(batch => batch.id === ai.targetSetId)?.name }}</p>
      <p class="text-sm text-slate-300">Будут отправлены параметры задачи{{ ai.preparedInput?.kind === 'tune' ? ', каталог и агрегаты выполнения' : ', данные каталога и необходимого инвентаря' }}. Оценка размера: {{ ai.preview.estimatedTokens }} токенов.</p>
      <details><summary>Состав отправляемых данных</summary><pre class="ai-payload mt-3">{{ JSON.stringify(ai.preview.payload, null, 2) }}</pre></details>
      <button type="button" class="primary-action" :disabled="ai.busy || !connectionReady" @click="ai.run">Отправить запрос</button>
    </section>
    <div v-if="ai.busy" class="flex flex-wrap items-center gap-3" role="status"><span>Выполняется запрос…</span><button type="button" class="setting-chip" @click="ai.cancel">Отменить запрос</button></div>
    <section v-if="ai.changeset" class="space-y-4" data-testid="ai-draft">
      <h3 class="text-lg font-semibold">{{ stateLabels[ai.changeset.status] }}</h3>
      <article v-for="row in rows" :key="row.index" class="settings-card space-y-3">
        <label class="flex items-start gap-3"><input type="checkbox" class="mt-1" :checked="ai.changeset.ops[row.index]?.enabled" :disabled="ai.busy || ai.changeset.status !== 'awaiting_approval' || ai.changeset.ops[row.index]?.state === 'rejected'" @change="ai.toggle(row.index)"><span><strong class="block">{{ row.title }}</strong><span class="text-sm text-slate-400">{{ row.action }}</span></span></label>
        <dl v-for="field in row.fields" :key="field.label" class="ai-field-diff"><dt class="text-xs text-slate-400">{{ field.label }}</dt><dd class="text-sm"><span v-if="ai.review" class="text-slate-400">{{ field.before }} → </span>{{ field.after }}</dd></dl>
        <p v-if="ai.changeset.ops[row.index]?.reason" class="text-sm text-slate-300">{{ ai.changeset.ops[row.index]?.reason }}</p>
        <p v-for="issue in ai.changeset.ops[row.index]?.issues" :key="issue" class="text-sm text-amber-300">{{ issue }}</p>
        <p v-if="ai.changeset.ops[row.index]?.state === 'rejected'" class="text-sm text-red-300">Проверка не пройдена — применить нельзя.</p>
      </article>
      <p v-if="ai.changeset.error" role="alert" class="text-sm text-red-300">{{ ai.changeset.error }}</p>
      <div class="flex flex-wrap gap-3"><button v-if="ai.changeset.status === 'awaiting_approval'" type="button" class="primary-action" :disabled="ai.busy || !ai.review || !validSelection" @click="ai.apply">Применить выбранное</button><button v-if="ai.changeset.status === 'awaiting_approval'" type="button" class="setting-chip" :disabled="ai.busy" @click="ai.discard">Отклонить черновик</button><button v-if="ai.changeset.status === 'applied'" type="button" class="setting-chip" :disabled="ai.busy" @click="ai.revert(ai.changeset.id)">Отменить применение</button></div>
    </section>
    <p v-if="ai.error" role="alert" class="text-sm text-red-300">{{ ai.error }}</p><p v-if="ai.status" role="status" class="text-sm text-emerald-400">{{ ai.status }}</p>
    <details v-if="ai.history.length"><summary>История предложений · {{ ai.history.length }}</summary><div class="mt-3 space-y-2"><button v-for="entry in ai.history" :key="entry.id" type="button" class="setting-chip block" :disabled="ai.busy" @click="ai.load(entry.id)">{{ taskLabels[entry.kind] }} · {{ stateLabels[entry.status] }} · {{ new Date(entry.createdAt).toLocaleString('ru-RU') }}</button></div></details>
  </section>
</template>
