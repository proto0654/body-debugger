<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { UpdateStatePayload } from '@shared/types/events'

// The window is transparent (electron/main/windows/update-prompt.ts); the card
// paints its own rounded surface, like the exercise popup.
document.documentElement.classList.add('window-popup')

const state = ref<UpdateStatePayload | null>(null)
const appLabel = ref('Body Debugger')
const error = ref('')
const installing = ref(false)
let unsubscribe: (() => void) | null = null

const availableVersion = computed(() => state.value?.availableVersion ?? '—')
const currentVersion = computed(() => state.value?.currentVersion ?? '—')
const percent = computed(() => state.value?.progressPercent ?? 0)
const isDownloading = computed(() => state.value?.status === 'downloading')
const isReady = computed(() => state.value?.status === 'ready')

const statusText = computed(() => {
  const value = state.value
  if (!value) return 'Читаем состояние обновления…'
  switch (value.status) {
    case 'downloading':
      return value.progressPercent === null
        ? 'Скачиваем обновление…'
        : `Скачиваем обновление — ${value.progressPercent}%`
    case 'ready':
      return 'Обновление скачано. Перезапустите, чтобы применить.'
    case 'error':
      return value.error ?? 'Не удалось проверить обновления.'
    case 'current':
      return 'Установлена последняя версия.'
    case 'disabled':
      return 'Обновления отключены в этой сборке.'
    default:
      return 'Проверяем обновления…'
  }
})

onMounted(async () => {
  const api = window.api
  if (!api?.getUpdateState) {
    error.value = 'Не удалось прочитать состояние обновления.'
    return
  }
  try {
    state.value = await api.getUpdateState()
    unsubscribe = api.onUpdateState(next => { state.value = next })
    const info = await window.api.getAppInfo?.()
    if (info) appLabel.value = info.channel === 'dev' ? 'Body Debugger Dev' : 'Body Debugger'
  } catch (cause) {
    console.error('[update-prompt] failed to read the update state', cause)
    error.value = 'Не удалось прочитать состояние обновления.'
  }
})

onBeforeUnmount(() => {
  unsubscribe?.()
  unsubscribe = null
  document.documentElement.classList.remove('window-popup')
})

async function install(): Promise<void> {
  if (installing.value) return
  if (!window.api?.installUpdate) return
  error.value = ''
  installing.value = true
  try {
    const result = await window.api.installUpdate()
    if (result.started) return
    installing.value = false
    error.value = result.reason === 'popup-open'
      ? 'Открыт попап с упражнением. Обновление установится при выходе.'
      : 'Обновление ещё не готово к установке.'
  } catch (cause) {
    console.error('[update-prompt] failed to install the update', cause)
    installing.value = false
    error.value = 'Не удалось запустить установку обновления.'
  }
}

async function dismiss(): Promise<void> {
  if (!window.api?.dismissUpdatePrompt) return
  try {
    await window.api.dismissUpdatePrompt()
  } catch (cause) {
    console.error('[update-prompt] failed to dismiss the update', cause)
    error.value = 'Не удалось закрыть окно. Нажмите «Позже» ещё раз.'
  }
}
</script>

<template>
  <main class="h-screen w-screen p-2">
    <section class="settings-card update-prompt-card flex h-full flex-col gap-3" data-testid="update-prompt">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">{{ appLabel }}</p>
          <h1 class="mt-1 truncate text-sm font-semibold text-white" data-testid="update-version">
            Обновление {{ availableVersion }}
          </h1>
          <p class="mt-1 text-xs text-slate-400">Текущая версия: {{ currentVersion }}</p>
        </div>
        <button
          type="button"
          class="update-prompt-close"
          aria-label="Закрыть"
          data-testid="update-close"
          @click="dismiss"
        >×</button>
      </div>

      <p class="text-xs leading-relaxed text-slate-300" data-testid="update-status">{{ statusText }}</p>

      <div
        v-if="isDownloading"
        class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="h-full rounded-full bg-emerald-400 transition-[width] duration-300" :style="{ width: `${percent}%` }" />
      </div>

      <div class="mt-auto flex flex-wrap items-center gap-2">
        <button
          v-if="isReady"
          type="button"
          class="setting-chip"
          data-testid="update-install"
          :disabled="installing"
          @click="install"
        >{{ installing ? 'Перезапускаем…' : 'Перезапустить и обновить' }}</button>
        <button
          type="button"
          class="setting-chip"
          data-testid="update-later"
          :disabled="installing"
          @click="dismiss"
        >Позже</button>
        <span v-if="isReady" class="text-[11px] leading-tight text-slate-500">Если закрыть, обновление установится при выходе.</span>
        <span v-else class="text-[11px] leading-tight text-slate-500">Загрузка продолжится в фоне.</span>
      </div>

      <p v-if="error" role="alert" class="text-xs leading-relaxed text-amber-300" data-testid="update-error">{{ error }}</p>
    </section>
  </main>
</template>
