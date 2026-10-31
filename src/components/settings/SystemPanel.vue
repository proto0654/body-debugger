<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { LaunchAtLoginState } from '@shared/domain/launch-at-login'

const state = ref<LaunchAtLoginState | null>(null)
const busy = ref(false)
const error = ref('')

async function load(): Promise<void> {
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

onMounted(() => { void load() })

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
  } catch (cause) {    console.error('[system] failed to change the launch-at-login state', cause)
    error.value = 'Не удалось изменить автозапуск. Попробуйте ещё раз.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="settings-card space-y-3" data-testid="system-panel">
    <div>
      <h2 class="text-sm font-semibold text-white">Система</h2>
      <p class="mt-1 text-xs leading-relaxed text-slate-400">Интеграция с Windows: автозапуск в трее.</p>
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
  </section>
</template>
