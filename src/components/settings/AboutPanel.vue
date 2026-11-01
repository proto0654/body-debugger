<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AppInfoPayload, UpdateStatePayload } from '@shared/types/events'

const info = ref<AppInfoPayload | null>(null)
const update = ref<UpdateStatePayload | null>(null)
const error = ref('')
const updateMessage = ref('')
const checking = ref(false)
let unsubscribeUpdate: (() => void) | null = null

const buildLabel = computed(() => info.value ? `${info.value.buildCommit} · ${info.value.buildDate}` : '—')
const channelLabel = computed(() => info.value?.channel === 'dev' ? 'тестовый (dev)' : 'стабильный')

const updateStatusLabel = computed(() => {
  const state = update.value
  if (!state) return 'Состояние обновлений неизвестно.'
  switch (state.status) {
    case 'disabled':
      return 'В сборке разработчика обновления отключены.'
    case 'idle':
      return 'Проверка выполняется автоматически раз в час.'
    case 'checking':
      return 'Проверяем обновления…'
    case 'current':
      return `Установлена последняя версия (${state.currentVersion}).`
    case 'downloading':
      return state.progressPercent === null
        ? `Скачиваем версию ${state.availableVersion}…`
        : `Скачиваем версию ${state.availableVersion} — ${state.progressPercent}%`
    case 'ready':
      return `Версия ${state.availableVersion} готова. Перезапустите, чтобы обновить.`
    case 'error':
      return state.error ?? 'Не удалось проверить обновления.'
  }
})

const canCheck = computed(() => {
  const status = update.value?.status
  return !checking.value && status !== 'disabled' && status !== 'checking' && status !== 'downloading' && status !== 'ready'
})

onMounted(async () => {
  try {
    info.value = (await window.api?.getAppInfo?.()) ?? null
  } catch (cause) {
    console.error('[about] failed to read the build info', cause)
    error.value = 'Не удалось прочитать данные о сборке.'
  }

  if (!window.api?.getUpdateState) return
  try {
    update.value = await window.api.getUpdateState()
    unsubscribeUpdate = window.api.onUpdateState?.(state => { update.value = state }) ?? null
  } catch (cause) {
    console.error('[about] failed to read the update state', cause)
  }
})

onUnmounted(() => {
  unsubscribeUpdate?.()
  unsubscribeUpdate = null
})

async function openLogs(): Promise<void> {
  error.value = ''
  try {
    const opened = await window.api?.openLogs?.()
    if (!opened) error.value = 'Не удалось открыть папку с логами.'
  } catch (cause) {
    console.error('[about] failed to open the log directory', cause)
    error.value = 'Не удалось открыть папку с логами.'
  }
}

async function checkForUpdates(): Promise<void> {
  updateMessage.value = ''
  checking.value = true
  try {
    const state = await window.api?.checkForUpdates?.()
    if (state) update.value = state
  } catch (cause) {
    console.error('[about] failed to check for updates', cause)
    updateMessage.value = 'Не удалось проверить обновления. Попробуйте позже.'
  } finally {
    checking.value = false
  }
}

async function installUpdate(): Promise<void> {
  updateMessage.value = ''
  try {
    const result = await window.api?.installUpdate?.()
    if (result?.started) return
    updateMessage.value = result?.reason === 'popup-open'
      ? 'Открыт попап с упражнением. Закройте его — обновление установится при выходе из приложения.'
      : 'Обновление ещё не готово к установке.'
  } catch (cause) {
    console.error('[about] failed to install the update', cause)
    updateMessage.value = 'Не удалось запустить установку обновления.'
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="settings-card space-y-3" data-testid="about-panel">
      <div>
        <h2 class="text-sm font-semibold text-white">О программе</h2>
        <p class="mt-1 text-xs leading-relaxed text-slate-400">
          Версия и сборка показывают, какое обновление установлено. Их стоит приложить к отчёту о проблеме.
        </p>
      </div>
      <dl class="grid gap-1 text-xs">
        <div class="flex justify-between gap-3">
          <dt class="text-slate-500">Версия</dt>
          <dd class="text-slate-200" data-testid="about-version">{{ info?.version ?? '—' }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-slate-500">Сборка</dt>
          <dd class="text-slate-200" data-testid="about-build">{{ buildLabel }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-slate-500">Режим</dt>
          <dd class="text-slate-200" data-testid="about-mode">{{ info ? (info.packaged ? 'установленная' : 'разработка') : '—' }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-slate-500">Канал</dt>
          <dd class="text-slate-200" data-testid="about-channel">{{ info ? channelLabel : '—' }}</dd>
        </div>
      </dl>
      <p v-if="info" class="break-all text-[11px] leading-relaxed text-slate-500">
        Данные: <span data-testid="about-data-path">{{ info.dataPath }}</span>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="setting-chip" :disabled="!info" @click="openLogs">Открыть папку с логами</button>
        <span v-if="error" class="text-xs text-red-300" role="alert">{{ error }}</span>
      </div>
    </section>

    <section class="settings-card space-y-3" data-testid="update-panel">
      <div>
        <h2 class="text-sm font-semibold text-white">Обновления</h2>
        <p class="mt-1 text-xs leading-relaxed text-slate-400">
          Новая версия скачивается в фоне, показывает прогресс в отдельном окне и устанавливается после перезапуска. Попап с упражнением не прерывается.
        </p>
        <p v-if="info?.channel === 'dev'" class="mt-1 text-xs leading-relaxed text-amber-300">
          Тестовый канал: сюда приходят только dev-релизы.
        </p>
      </div>
      <p class="text-xs text-slate-300" data-testid="update-status">{{ updateStatusLabel }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="setting-chip" :disabled="!canCheck" @click="checkForUpdates">
          Проверить обновления
        </button>
        <button
          v-if="update?.status === 'ready'"
          type="button"
          class="setting-chip"
          data-testid="update-install"
          @click="installUpdate"
        >Перезапустить и обновить</button>
        <span v-if="updateMessage" class="text-xs text-amber-300" role="status">{{ updateMessage }}</span>
      </div>
    </section>
  </div>
</template>
