<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { LaunchAtLoginState } from '@shared/domain/launch-at-login'
import type { TrayPinState } from '@shared/domain/tray-pin'

const state = ref<LaunchAtLoginState | null>(null)
const pin = ref<TrayPinState | null>(null)
const busy = ref(false)
const pinBusy = ref(false)
const error = ref('')
const pinError = ref('')

async function loadLaunch(): Promise<void> {
  const api = window.api
  if (!api?.getLaunchAtLogin) {
    error.value = 'Не удалось прочитать настройку автозапуска.'
    return
  }
  try {
    state.value = await api.getLaunchAtLogin()
  } catch (cause) {
    console.error('[system] failed to read the launch-at-login state', cause)
    error.value = 'Не удалось прочитать настройку автозапуска.'
  }
}

async function loadPin(): Promise<void> {
  const api = window.api
  if (!api?.getTrayPin) {
    pin.value = { supported: false, enabled: false }
    return
  }
  try {
    pin.value = await api.getTrayPin()
  } catch (cause) {
    console.error('[system] failed to read the tray pin state', cause)
    pinError.value = 'Не удалось прочитать настройку значка у часов.'
  }
}

onMounted(() => {
  void loadLaunch()
  void loadPin()
})

async function toggle(): Promise<void> {
  if (!state.value?.supported || busy.value) return
  const next = !state.value.enabled
  busy.value = true
  error.value = ''
  try {
    const result = await window.api.setLaunchAtLogin(next)
    state.value = result
    if (result.enabled !== next) {
      error.value = 'Windows не применил настройку. Проверьте «Диспетчер задач → Автозагрузка».'
    }
  } catch (cause) {
    console.error('[system] failed to change the launch-at-login state', cause)
    error.value = 'Не удалось изменить автозапуск. Попробуйте ещё раз.'
  } finally {
    busy.value = false
  }
}

async function togglePin(): Promise<void> {
  if (!pin.value?.supported || pinBusy.value) return
  const next = !pin.value.enabled
  pinBusy.value = true
  pinError.value = ''
  try {
    const result = await window.api.setTrayPin(next)
    pin.value = result
    if (result.enabled !== next) {
      pinError.value = 'Windows не закрепил значок. Проверьте «Параметры → Персонализация → Панель задач → Другие значки панели задач».'
    }
  } catch (cause) {
    console.error('[system] failed to change the tray pin state', cause)
    pinError.value = 'Не удалось изменить значок у часов. Попробуйте ещё раз.'
  } finally {
    pinBusy.value = false
  }
}
</script>

<template>
  <section class="settings-card space-y-3" data-testid="system-panel">
    <div>
      <h2 class="text-sm font-semibold text-white">Система</h2>
      <p class="mt-1 text-xs leading-relaxed text-slate-400">Интеграция с Windows: автозапуск и значок у часов.</p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-xs text-slate-200">Запускать при входе в Windows</p>
        <p class="mt-1 text-[11px] leading-relaxed text-slate-500">
          Приложение стартует в трее и не открывает окно. Настройка хранится в Windows.
        </p>
      </div>
      <button
        type="button"
        class="setting-chip"
        data-testid="launch-at-login-toggle"
        :disabled="!state?.supported || busy"
        :aria-pressed="state?.enabled === true"
        :aria-label="`Автозапуск: ${state?.enabled ? 'выключить' : 'включить'}`"
        @click="toggle"
      >
        {{ state === null ? '…' : state.supported ? (state.enabled ? 'Вкл' : 'Выкл') : 'Недоступно' }}
      </button>
    </div>

    <p v-if="state && !state.supported" class="text-xs leading-relaxed text-slate-500" data-testid="launch-at-login-unsupported">
      Доступно только в установленной Windows-сборке. В режиме разработки автозапуск не меняется.
    </p>
    <p
      v-if="state?.supported && state.enabled && !state.willLaunch"
      class="rounded-lg border border-amber-400/25 bg-amber-400/5 p-2 text-xs leading-relaxed text-amber-200"
      data-testid="launch-at-login-disabled-by-os"
    >
      Windows отключил автозапуск в диспетчере задач. Включите его там или переключите настройку заново.
    </p>
    <p v-if="error" role="alert" class="text-xs leading-relaxed text-red-300" data-testid="launch-at-login-error">{{ error }}</p>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-xs text-slate-200">Показывать у часов</p>
        <p class="mt-1 text-[11px] leading-relaxed text-slate-500">
          Значок остаётся рядом с часами. Иначе Windows прячет его под кнопкой «^».
        </p>
      </div>
      <button
        type="button"
        class="setting-chip"
        data-testid="tray-pin-toggle"
        :disabled="!pin?.supported || pinBusy"
        :aria-pressed="pin?.enabled === true"
        :aria-label="`Значок у часов: ${pin?.enabled ? 'выключить' : 'включить'}`"
        @click="togglePin"
      >
        {{ pin === null ? '…' : pin.supported ? (pin.enabled ? 'Вкл' : 'Выкл') : 'Недоступно' }}
      </button>
    </div>

    <p v-if="pin && !pin.supported" class="text-xs leading-relaxed text-slate-500" data-testid="tray-pin-unsupported">
      Доступно в установленной сборке Windows 11. В режиме разработки и на старых Windows значок не закрепляется.
    </p>
    <p v-if="pinError" role="alert" class="text-xs leading-relaxed text-red-300" data-testid="tray-pin-error">{{ pinError }}</p>
  </section>
</template>
