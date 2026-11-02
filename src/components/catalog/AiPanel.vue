<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { COVERAGE_THRESHOLD } from '@shared/constants/catalog-tuning'
import { METHOD_LABELS, ZONE_LABELS } from '@shared/constants/catalog-axes'
import { summarize, type Changeset } from '@shared/domain/changeset'
import { useCatalogStore } from '@/stores/catalog'
import { useSettingsStore } from '@/stores/settings'

const catalog = useCatalogStore()
const settings = useSettingsStore()
const busy = ref(false)
const status = ref('')
const error = ref('')
const hasKey = ref(false)
const keyDraft = ref('')
const previewTokens = ref<number | null>(null)
const changeset = ref<Changeset | null>(null)
const targetSetId = ref('user-main')
let unsubscribe: (() => void) | undefined

const selectedCellLabel = computed(() => {
  const cell = catalog.selectedCell
  if (!cell) return null
  return `${ZONE_LABELS[cell.zone]} · ${METHOD_LABELS[cell.method]}`
})

const emptyCells = computed(() => catalog.coverage.filter((cell) => cell.belowThreshold))

const summary = computed(() => (changeset.value ? summarize(changeset.value) : null))

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

async function previewGenerate(): Promise<void> {
  const cells = emptyCells.value.map((cell) => ({
    zone: cell.zone,
    method: cell.method,
    count: Math.max(1, COVERAGE_THRESHOLD - cell.count)
  }))
  try {
    const preview = await window.api?.previewLlmRequest?.({
      kind: 'generate',
      cells,
      targetSetId: targetSetId.value
    })
    previewTokens.value = preview?.estimatedTokens ?? null
  } catch {
    previewTokens.value = null
  }
}

async function runGenerateEmpty(): Promise<void> {
  status.value = ''
  error.value = ''
  busy.value = true
  const cells =
    catalog.selectedCell != null
      ? [
          {
            zone: catalog.selectedCell.zone,
            method: catalog.selectedCell.method,
            count: COVERAGE_THRESHOLD
          }
        ]
      : emptyCells.value.map((cell) => ({
          zone: cell.zone,
          method: cell.method,
          count: Math.max(1, COVERAGE_THRESHOLD - cell.count)
        }))
  try {
    await previewGenerate()
    const next = await window.api?.runLlm?.({
      kind: 'generate',
      cells,
      targetSetId: targetSetId.value
    })
    if (next) changeset.value = next
    status.value = next
      ? 'Черновик готов — проверьте операции и примените.'
      : 'Все клетки уже выше порога или IPC недоступен.'
  } catch (cause) {
    console.warn('[catalog-ai] runLlm generate', cause)
    error.value = 'Генерация недоступна — проверьте провайдер и ключ.'
  } finally {
    busy.value = false
  }
}

async function runAnalyzeProgress(): Promise<void> {
  status.value = ''
  error.value = ''
  busy.value = true
  try {
    const next = await window.api?.runLlm?.({
      kind: 'tune',
      targetSetId: targetSetId.value
    })
    if (next) changeset.value = next
    status.value = 'Черновик анализа прогресса готов.'
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
  status.value = 'Черновик отброшен.'
}

async function revertChangeset(): Promise<void> {
  if (!changeset.value) return
  busy.value = true
  try {
    const next = await window.api?.revertLlmChangeset?.(changeset.value.id)
    if (next) changeset.value = next
    await catalog.refresh()
    status.value = 'Изменения откатены.'
  } finally {
    busy.value = false
  }
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
  unsubscribe = window.api?.onLlmChanged?.((payload) => {
    changeset.value = payload.changeset
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
        <option v-for="batch in catalog.batches.filter((b) => b.kind !== 'shipped')" :key="batch.id" :value="batch.id">
          {{ batch.name }}
        </option>
      </select>
    </label>

    <p v-if="selectedCellLabel" class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
      Контекст генерации: {{ selectedCellLabel }}
    </p>
    <p v-if="previewTokens !== null" class="text-xs text-slate-500">Оценка токенов запроса: ~{{ previewTokens }}</p>

    <div class="flex flex-wrap gap-2">
      <button type="button" class="setting-chip" :disabled="busy || !settings.llm.enabled" @click="runGenerateEmpty">
        Сгенерировать для пустых клеток
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
            @click="revertChangeset"
          >
            Откатить
          </button>
        </div>
      </div>
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

    <p v-if="status" class="text-xs text-emerald-400" role="status">{{ status }}</p>
    <p v-if="error" class="text-xs text-red-300" role="alert">{{ error }}</p>
  </section>
</template>
