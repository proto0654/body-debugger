<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CatalogBatch } from '@shared/types/exercise-v2'
import { useCatalogStore } from '@/stores/catalog'
import { useSettingsStore } from '@/stores/settings'

const catalog = useCatalogStore()
const settings = useSettingsStore()
const busy = ref<string | null>(null)
const newSetName = ref('')
const renameDrafts = ref<Record<string, string>>({})

const BATCH_KIND_LABELS: Record<CatalogBatch['kind'], string> = {
  shipped: 'Встроенные',
  user: 'Свои',
  llm: 'AI',
  'legacy-import': 'Импорт'
}

function exerciseTitle(id: string): string {
  return catalog.resolved.find((exercise) => exercise.id === id)?.title ?? id
}

function renameValue(batch: CatalogBatch): string {
  return renameDrafts.value[batch.id] ?? batch.name
}

async function toggleBatch(batch: CatalogBatch, enabled: boolean): Promise<void> {
  if (batch.kind === 'shipped' || batch.enabled === enabled) return
  busy.value = batch.id
  const previous = batch.enabled
  batch.enabled = enabled
  try {
    const result = await window.api?.setCatalogBatchEnabled?.({ id: batch.id, enabled })
    if (result?.ok === false) batch.enabled = previous
    else if (result?.catalog) catalog.applyCatalogFile(result.catalog)
  } catch (cause) {
    console.warn('[catalog] setCatalogBatchEnabled failed', cause)
    batch.enabled = previous
  } finally {
    busy.value = null
  }
}

async function renameBatch(batch: CatalogBatch): Promise<void> {
  if (batch.kind === 'shipped') return
  const name = renameValue(batch).trim()
  if (!name || name === batch.name) return
  busy.value = batch.id
  try {
    const result = await window.api?.renameCatalogBatch?.({ id: batch.id, name })
    if (result?.catalog) catalog.applyCatalogFile(result.catalog)
    delete renameDrafts.value[batch.id]
  } catch (cause) {
    console.warn('[catalog] renameCatalogBatch failed', cause)
  } finally {
    busy.value = null
  }
}

async function createSet(): Promise<void> {
  const name = newSetName.value.trim()
  if (!name) return
  busy.value = 'create'
  try {
    const result = await window.api?.createCatalogBatch?.({ name })
    if (result?.catalog) catalog.applyCatalogFile(result.catalog)
    if (result?.ok) newSetName.value = ''
  } catch (cause) {
    console.warn('[catalog] createCatalogBatch failed', cause)
  } finally {
    busy.value = null
  }
}

async function acceptHint(exerciseId: string, scale: number): Promise<void> {
  busy.value = exerciseId
  try {
    await settings.setExerciseScale(exerciseId, scale, 'suggest')
  } finally {
    busy.value = null
  }
}

async function undoScale(exerciseId?: string): Promise<void> {
  busy.value = exerciseId ?? 'undo'
  try {
    await settings.undoExerciseScale(exerciseId)
  } finally {
    busy.value = null
  }
}

const showHints = computed(() => settings.autoTune !== 'off')
const scaleHistory = computed(() => settings.scaleHistory)
</script>

<template>
  <section class="settings-card space-y-4" data-testid="catalog-sets">
    <div>
      <h2 class="text-sm font-semibold text-white">Наборы упражнений</h2>
      <p class="mt-1 text-xs text-slate-400">
        Отключённый набор не участвует в подборе. Подсказки дозы — только здесь.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <input
        v-model="newSetName"
        type="text"
        class="min-w-[12rem] flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
        placeholder="Название нового набора"
        :disabled="busy === 'create'"
        @keydown.enter.prevent="createSet"
      />
      <button
        type="button"
        class="setting-chip"
        :disabled="busy === 'create' || !newSetName.trim()"
        @click="createSet"
      >
        Создать набор
      </button>
    </div>

    <ul class="space-y-3">
      <li
        v-for="batch in catalog.batches"
        :key="batch.id"
        class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-2">
            <template v-if="batch.kind !== 'shipped'">
              <div class="flex flex-wrap gap-2">
                <input
                  type="text"
                  class="min-w-[10rem] flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  :value="renameValue(batch)"
                  :disabled="busy === batch.id"
                  @input="renameDrafts[batch.id] = ($event.target as HTMLInputElement).value"
                  @keydown.enter.prevent="renameBatch(batch)"
                />
                <button
                  type="button"
                  class="setting-chip"
                  :disabled="busy === batch.id || renameValue(batch).trim() === batch.name"
                  @click="renameBatch(batch)"
                >
                  Переименовать
                </button>
              </div>
            </template>
            <p v-else class="text-sm font-medium text-white">{{ batch.name }}</p>
            <p class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span class="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">{{ BATCH_KIND_LABELS[batch.kind] }}</span>
              <span>{{ batch.count }} упражн.</span>
              <span v-if="batch.model">· {{ batch.model }}</span>
            </p>
          </div>
          <div v-if="batch.kind !== 'shipped'" class="flex gap-1">
            <button
              type="button"
              class="setting-chip"
              :disabled="busy === batch.id || batch.enabled"
              :aria-pressed="batch.enabled"
              @click="toggleBatch(batch, true)"
            >
              Вкл
            </button>
            <button
              type="button"
              class="setting-chip"
              :disabled="busy === batch.id || !batch.enabled"
              :aria-pressed="!batch.enabled"
              @click="toggleBatch(batch, false)"
            >
              Выкл
            </button>
          </div>
          <span v-else class="text-xs text-slate-500">Всегда включён</span>
        </div>
      </li>
    </ul>

    <div v-if="showHints && catalog.hints.length > 0" class="border-t border-slate-800 pt-4 space-y-3">
      <h3 class="text-sm font-semibold text-white">Подсказки по дозе</h3>
      <ul class="space-y-2">
        <li
          v-for="hint in catalog.hints"
          :key="`${hint.exerciseId}-${hint.kind}`"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
        >
          <div>
            <p class="font-medium text-slate-200">{{ exerciseTitle(hint.exerciseId) }}</p>
            <p class="mt-0.5 text-slate-500">
              <span
                class="rounded-md px-1.5 py-0.5"
                :class="hint.kind === 'ready_to_progress' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'"
              >
                {{ hint.kind === 'ready_to_progress' ? 'Готов к прогрессу' : 'Часто пропускают' }}
              </span>
              · масштаб {{ hint.suggestedScale.toFixed(2) }}
            </p>
          </div>
          <button
            v-if="settings.autoTune === 'suggest'"
            type="button"
            class="setting-chip"
            :disabled="busy === hint.exerciseId"
            @click="acceptHint(hint.exerciseId, hint.suggestedScale)"
          >
            Принять
          </button>
        </li>
      </ul>
    </div>
    <p v-else-if="showHints" class="text-xs text-slate-500">Подсказок пока нет — нужно больше показов упражнений.</p>
    <p v-else class="text-xs text-slate-500">Подсказки отключены в настройках autoTune.</p>

    <div v-if="scaleHistory.length > 0" class="border-t border-slate-800 pt-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-white">История масштаба дозы</h3>
        <button
          type="button"
          class="setting-chip"
          :disabled="busy === 'undo'"
          @click="undoScale()"
        >
          Отменить последнее
        </button>
      </div>
      <ul class="space-y-2">
        <li
          v-for="entry in scaleHistory"
          :key="`${entry.exerciseId}-${entry.at}`"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400"
        >
          <span>
            {{ exerciseTitle(entry.exerciseId) }}
            · {{ entry.fromScale.toFixed(2) }} → {{ entry.toScale.toFixed(2) }}
            · {{ entry.source }}
          </span>
          <button
            type="button"
            class="setting-chip"
            :disabled="busy === entry.exerciseId"
            @click="undoScale(entry.exerciseId)"
          >
            Undo
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
