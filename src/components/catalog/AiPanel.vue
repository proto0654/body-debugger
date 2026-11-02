<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { COVERAGE_THRESHOLD, LLM_MAX_EXERCISES } from '@shared/constants/catalog-tuning'
import { METHOD_LABELS, ZONE_LABELS } from '@shared/constants/catalog-axes'
import { summarize, type Changeset, type ChangesetKind } from '@shared/domain/changeset'
import { capGenerateCells } from '@shared/domain/llm-prompt'
import type { LlmPreviewResponsePayload } from '@shared/types/events'
import { useCatalogStore } from '@/stores/catalog'
import { useSettingsStore } from '@/stores/settings'

const catalog = useCatalogStore()
const settings = useSettingsStore()
const busy = ref(false)
const status = ref('')
const error = ref('')
const hasKey = ref(false)
const keyDraft = ref('')
const instruction = ref('')
const preview = ref<LlmPreviewResponsePayload | null>(null)
const changeset = ref<Changeset | null>(null)
const history = ref<Changeset[]>([])
const targetSetId = ref('user-main')
const showPreviewJson = ref(false)
let unsubscribe: (() => void) | undefined

const selectedCellLabel = computed(() => {
  const cell = catalog.selectedCell
  if (!cell) return null
  return `${ZONE_LABELS[cell.zone]} · ${METHOD_LABELS[cell.method]}`
})

const emptyCells = computed(() => catalog.coverage.filter((cell) => cell.belowThreshold))

const summary = computed(() => (changeset.value ? summarize(changeset.value) : null))

const editableBatches = computed(() =>
  catalog.batches.filter((batch) => batch.kind !== 'shipped')
)

async function saveLlm(patch: Parameters<typeof settings.setLlmConfig>[0]): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await settings.setLlmConfig(patch)
    await window.api?.saveLlmConfig?.({ llm: patch })
  } catch (cause) {
    console.error('[catalog-ai] save llm failed', cause)
    error.value = 'Не удалось сохранить настройки провайдера.'
  } finally {
    busy.value = false
  }
}

async function saveKey(): Promise<void> {
  if (!keyDraft.value.trim()) return
  busy.value = true
  try {
    const result = await window.api?.setLlmKey?.({ key: keyDraft.value.trim() })
    hasKey.value = result?.hasKey === true
    keyDraft.value = ''
    status.value = hasKey.value ? 'Ключ сохранён.' : 'Ключ не сохранился.'
  } catch (cause) {
    console.error('[catalog-ai] set key failed', cause)
    error.value = 'Не удалось сохранить ключ.'
  } finally {
    busy.value = false
  }
}

async function testConnection(): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    const result = await window.api?.testLlm?.()
    status.value = result?.ok ? `Связь ок: ${result.message}` : `Связь не удалась: ${result?.message ?? 'нет ответа'}`
  } catch (cause) {
    console.warn('[catalog-ai] testLlm', cause)
    error.value = 'Тест провайдера недоступен.'
  } finally {
    busy.value = false
  }
}

async function cancelRun(): Promise<void> {
  try {
    const result = await window.api?.cancelLlm?.()
    status.value = result?.cancelled ? 'Запрос отменён.' : 'Нечего отменять.'
  } catch {
    error.value = 'Не удалось отменить запрос.'
  }
}

async function refreshHistory(): Promise<void> {
  try {
    history.value = (await window.api?.listLlmChangesets?.()) ?? []
  } catch {
    history.value = []
  }
}

function emptyCoverageCells() {
  return capGenerateCells(
    emptyCells.value.map((cell) => ({
      zone: cell.zone,
      method: cell.method,
      count: Math.max(1, COVERAGE_THRESHOLD - cell.count)
    }))
  )
}

function selectedCoverageCell() {
  const cell = catalog.selectedCell
  if (!cell) return []
  const coverage = catalog.coverage.find(
    (entry) => entry.zone === cell.zone && entry.method === cell.method
  )
  return capGenerateCells([
    {
      zone: cell.zone,
      method: cell.method,
      count: Math.max(1, COVERAGE_THRESHOLD - (coverage?.count ?? 0))
    }
  ])
}

function requestedExerciseCount(cells: ReturnType<typeof emptyCoverageCells>): number {
  return cells.reduce((sum, cell) => sum + cell.count, 0)
}

function clearSelectedCell(): void {
  catalog.clearSelectedCell()
}

async function showPreview(kind: ChangesetKind, cells = emptyCoverageCells()): Promise<void> {
  try {
    const payload =
      kind === 'generate'
        ? {
            kind,
            cells,
            targetSetId: targetSetId.value
          }
        : {
            kind,
            instruction: instruction.value.trim() || undefined,
            targetSetId: targetSetId.value
          }
    const next = await window.api?.previewLlmRequest?.(payload)
    preview.value = next ?? null
    showPreviewJson.value = true
  } catch {
    preview.value = null
  }
}

async function runGenerate(cells: ReturnType<typeof emptyCoverageCells>, label: string): Promise<void> {
  status.value = ''
  error.value = ''
  if (cells.length === 0) {
    error.value = 'Нет клеток ниже порога для генерации.'
    return
  }
  const exerciseCount = requestedExerciseCount(cells)
  busy.value = true
  try {
    await showPreview('generate', cells)
    const next = await window.api?.runLlm?.({
      kind: 'generate',
      cells,
      targetSetId: targetSetId.value
    })
    if (next) changeset.value = next
    if (next?.status === 'failed') {
      error.value = next.error || 'Генерация завершилась с ошибкой.'
      status.value = ''
    } else {
      status.value = next
        ? `Черновик готов (${label}, ≤${exerciseCount} упр. / лимит ${LLM_MAX_EXERCISES}) — проверьте и примените.`
        : 'Все клетки уже выше порога или IPC недоступен.'
    }
    await refreshHistory()
  } catch (cause) {
    console.warn('[catalog-ai] runLlm generate', cause)
    const detail = cause instanceof Error ? cause.message : ''
    error.value = detail
      ? `Генерация не удалась: ${detail}`
      : 'Генерация недоступна — проверьте провайдер и ключ.'
  } finally {
    busy.value = false
  }
}

async function runGenerateEmpty(): Promise<void> {
  // Always all below-threshold cells — selection must not shrink the request.
  clearSelectedCell()
  await runGenerate(emptyCoverageCells(), 'все пустые')
}

async function runGenerateSelected(): Promise<void> {
  await runGenerate(selectedCoverageCell(), 'выбранная клетка')
}

async function runInstruction(kind: 'edit' | 'retag'): Promise<void> {
  const text = instruction.value.trim()
  if (!text) {
    error.value = 'Введите инструкцию для изменения или retag.'
    return
  }
  status.value = ''
  error.value = ''
  busy.value = true
  try {
    await showPreview(kind)
    const next = await window.api?.runLlm?.({
      kind,
      instruction: text,
      targetSetId: targetSetId.value
    })
    if (next) changeset.value = next
    status.value =
      kind === 'retag'
        ? 'Черновик retag готов.'
        : 'Черновик правок готов — проверьте операции и примените.'
    await refreshHistory()
  } catch (cause) {
    console.warn(`[catalog-ai] runLlm ${kind}`, cause)
    error.value = kind === 'retag' ? 'Retag недоступен.' : 'Изменение набора недоступно.'
  } finally {
    busy.value = false
  }
}

async function runAnalyzeProgress(): Promise<void> {
  status.value = ''
  error.value = ''
  busy.value = true
  try {
    await showPreview('tune')
    const next = await window.api?.runLlm?.({
      kind: 'tune',
      targetSetId: targetSetId.value
    })
    if (next) changeset.value = next
    status.value = 'Черновик анализа прогресса готов.'
    await refreshHistory()
  } catch (cause) {
    console.warn('[catalog-ai] runLlm tune', cause)
    error.value = 'Анализ прогресса недоступен.'
  } finally {
    busy.value = false
  }
}

async function toggleOp(index: number): Promise<void> {
  if (!changeset.value) return
  const next = await window.api?.toggleLlmOp?.({
    changesetId: changeset.value.id,
    index
  })
  if (next) changeset.value = next
}

async function applyChangeset(): Promise<void> {
  if (!changeset.value) return
  busy.value = true
  try {
    const next = await window.api?.applyLlmChangeset?.(changeset.value.id)
    if (next) changeset.value = next
    await catalog.refresh()
    await refreshHistory()
    status.value = 'Изменения применены.'
  } catch (cause) {
    console.error('[catalog-ai] apply failed', cause)
    error.value = 'Не удалось применить changeset.'
  } finally {
    busy.value = false
  }
}

async function discardChangeset(): Promise<void> {
  if (!changeset.value) return
  const next = await window.api?.discardLlmChangeset?.(changeset.value.id)
  if (next) changeset.value = next
  await refreshHistory()
  status.value = 'Черновик отброшен.'
}

async function revertChangeset(id?: string): Promise<void> {
  const targetId = id ?? changeset.value?.id
  if (!targetId) return
  busy.value = true
  try {
    const next = await window.api?.revertLlmChangeset?.(targetId)
    if (next) changeset.value = next
    await catalog.refresh()
    await refreshHistory()
    status.value = 'Изменения откатены.'
  } finally {
    busy.value = false
  }
}

async function loadHistoryItem(id: string): Promise<void> {
  const next = await window.api?.getLlmChangeset?.(id)
  if (next) changeset.value = next
}

async function refreshLlmFromMain(): Promise<void> {
  try {
    const config = await window.api?.getLlmConfig?.()
    if (config?.llm) {
      await settings.setLlmConfig(config.llm)
      hasKey.value = config.hasKey
    }
  } catch {
    /* optional */
  }
}

onMounted(() => {
  void refreshLlmFromMain()
  void refreshHistory()
  unsubscribe = window.api?.onLlmChanged?.((payload) => {
    changeset.value = payload.changeset
    void refreshHistory()
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <section class="settings-card space-y-4" data-testid="catalog-ai">
    <div>
      <h2 class="text-sm font-semibold text-white">Провайдер LLM</h2>
      <p class="mt-1 text-xs text-slate-400">
        Ключ хранится только в main. Для локальной проверки укажите base URL
        <code class="text-slate-300">mock://local</code>.
      </p>
    </div>

    <label class="flex items-center justify-between gap-3 text-sm text-slate-300">
      Включить слой
      <input
        type="checkbox"
        class="h-4 w-4 accent-emerald-500"
        :checked="settings.llm.enabled"
        :disabled="busy"
        @change="saveLlm({ enabled: ($event.target as HTMLInputElement).checked })"
      />
    </label>

    <label class="block text-xs text-slate-400">
      Базовый URL
      <input
        type="url"
        class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
        :value="settings.llm.baseUrl"
        :disabled="busy || !settings.llm.enabled"
        @change="saveLlm({ baseUrl: ($event.target as HTMLInputElement).value.trim() })"
      />
    </label>

    <label class="block text-xs text-slate-400">
      Модель
      <input
        type="text"
        class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
        :value="settings.llm.model"
        :disabled="busy || !settings.llm.enabled"
        @change="saveLlm({ model: ($event.target as HTMLInputElement).value.trim() })"
      />
    </label>

    <label class="block text-xs text-slate-400">
      API-ключ {{ hasKey ? '(сохранён)' : '(нет)' }}
      <div class="mt-1 flex gap-2">
        <input
          type="password"
          class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
          v-model="keyDraft"
          :disabled="busy || !settings.llm.enabled"
          placeholder="вставьте ключ"
        />
        <button type="button" class="setting-chip" :disabled="busy || !keyDraft.trim()" @click="saveKey">
          Сохранить
        </button>
      </div>
    </label>

    <div class="flex flex-wrap gap-2">
      <button type="button" class="setting-chip" :disabled="busy || !settings.llm.enabled" @click="testConnection">
        Проверить связь
      </button>
      <button type="button" class="setting-chip" :disabled="!busy" @click="cancelRun">
        Отменить запрос
      </button>
    </div>

    <label class="flex items-center justify-between gap-3 text-sm text-slate-300">
      Делиться агрегатами прогресса
      <input
        type="checkbox"
        class="h-4 w-4 accent-emerald-500"
        :checked="settings.llm.shareProgress"
        :disabled="busy || !settings.llm.enabled"
        @change="saveLlm({ shareProgress: ($event.target as HTMLInputElement).checked })"
      />
    </label>

    <label class="block text-xs text-slate-400">
      Целевой набор
      <select
        class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        v-model="targetSetId"
        :disabled="busy"
      >
        <option v-for="batch in editableBatches" :key="batch.id" :value="batch.id">
          {{ batch.name }}
        </option>
      </select>
    </label>

    <label class="block text-xs text-slate-400">
      Инструкция (edit / retag)
      <textarea
        v-model="instruction"
        rows="3"
        class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
        :disabled="busy || !settings.llm.enabled"
        placeholder="например: сделай растяжки длиннее, добавь для запястий"
      />
    </label>

    <p
      v-if="selectedCellLabel"
      class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200"
    >
      <span>Выбранная клетка: {{ selectedCellLabel }}</span>
      <button type="button" class="setting-chip text-[11px]" :disabled="busy" @click="clearSelectedCell">
        Сбросить
      </button>
    </p>
    <p v-else-if="emptyCells.length > 0" class="text-xs text-slate-500">
      Пустых клеток: {{ emptyCells.length }} — запрос ограничен
      {{ LLM_MAX_EXERCISES }} упражнениями (по клеткам по кругу), чтобы провайдер не уходил в таймаут.
    </p>

    <div v-if="preview" class="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-slate-400">
          Preview · ~{{ preview.estimatedTokens }} ток.
        </p>
        <button type="button" class="setting-chip" @click="showPreviewJson = !showPreviewJson">
          {{ showPreviewJson ? 'Скрыть JSON' : 'Показать JSON' }}
        </button>
      </div>
      <pre
        v-if="showPreviewJson"
        class="max-h-48 overflow-auto rounded-lg bg-slate-950 p-2 text-[11px] leading-relaxed text-slate-300"
      >{{ JSON.stringify(preview.payload, null, 2) }}</pre>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="setting-chip"
        :disabled="busy || !settings.llm.enabled || emptyCells.length === 0"
        @click="runGenerateEmpty"
      >
        Сгенерировать для пустых клеток
      </button>
      <button
        type="button"
        class="setting-chip"
        :disabled="busy || !settings.llm.enabled || !selectedCellLabel"
        @click="runGenerateSelected"
      >
        Только выбранная клетка
      </button>
      <button
        type="button"
        class="setting-chip"
        :disabled="busy || !settings.llm.enabled || !instruction.trim()"
        @click="runInstruction('edit')"
      >
        Изменить набор
      </button>
      <button
        type="button"
        class="setting-chip"
        :disabled="busy || !settings.llm.enabled || !instruction.trim()"
        @click="runInstruction('retag')"
      >
        Retag
      </button>
      <button
        type="button"
        class="setting-chip"
        :disabled="busy || !settings.llm.enabled || !settings.llm.shareProgress"
        @click="runAnalyzeProgress"
      >
        Проанализировать прогресс
      </button>
    </div>

    <div v-if="changeset" class="rounded-xl border border-slate-700 bg-slate-950/40 p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-slate-200">
          Changeset
          <span v-if="summary" class="text-slate-500">
            (+{{ summary.add }} / ~{{ summary.update }} / −{{ summary.archive }})
          </span>
          · {{ changeset.status }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="changeset.status === 'awaiting_approval'"
            type="button"
            class="setting-chip"
            :disabled="busy"
            @click="applyChangeset"
          >
            Применить
          </button>
          <button
            v-if="changeset.status === 'awaiting_approval'"
            type="button"
            class="setting-chip"
            :disabled="busy"
            @click="discardChangeset"
          >
            Отбросить
          </button>
          <button
            v-if="changeset.status === 'applied'"
            type="button"
            class="setting-chip"
            :disabled="busy"
            @click="revertChangeset()"
          >
            Откатить
          </button>
        </div>
      </div>
      <p
        v-if="changeset.status === 'failed' && changeset.error"
        class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        role="alert"
      >
        {{ changeset.error }}
      </p>
      <ul class="space-y-2">
        <li
          v-for="(record, index) in changeset.ops"
          :key="index"
          class="flex items-start gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs"
        >
          <input
            type="checkbox"
            class="mt-0.5 accent-emerald-500"
            :checked="record.enabled"
            :disabled="record.state === 'rejected' || changeset.status !== 'awaiting_approval'"
            @change="toggleOp(index)"
          />
          <div>
            <p class="text-slate-200">{{ record.op.op }} <span class="text-slate-500">· {{ record.state }}</span></p>
            <p v-if="record.reason" class="mt-1 text-slate-400">{{ record.reason }}</p>
            <p v-for="issue in record.issues" :key="issue" class="mt-1 text-amber-300">{{ issue }}</p>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="history.length > 0" class="border-t border-slate-800 pt-4 space-y-2">
      <h3 class="text-sm font-semibold text-white">История changesets</h3>
      <ul class="space-y-2">
        <li
          v-for="entry in history"
          :key="entry.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs"
        >
          <button type="button" class="text-left text-slate-300 hover:text-white" @click="loadHistoryItem(entry.id)">
            <span class="font-medium text-slate-200">{{ entry.kind }}</span>
            · {{ entry.status }}
            · {{ new Date(entry.createdAt).toLocaleString('ru-RU') }}
          </button>
          <button
            v-if="entry.status === 'applied'"
            type="button"
            class="setting-chip"
            :disabled="busy"
            @click="revertChangeset(entry.id)"
          >
            Откатить
          </button>
        </li>
      </ul>
    </div>

    <p v-if="status" class="text-xs text-emerald-400" role="status">{{ status }}</p>
    <p v-if="error" class="text-xs text-red-300" role="alert">{{ error }}</p>
  </section>
</template>
