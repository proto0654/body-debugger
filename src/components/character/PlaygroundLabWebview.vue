<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const host = ref<HTMLElement | null>(null)
const error = ref('')
let view: HTMLElement | null = null

function mount(): void {
  if (!host.value || view) return
  const preload = window.api?.labViewPreload
  if (!preload) {
    error.value = 'Мост лаборатории недоступен в этой сборке.'
    return
  }
  const element = document.createElement('webview') as HTMLElement
  element.setAttribute('webpreferences', 'nodeIntegration=no,contextIsolation=yes,sandbox=no')
  element.setAttribute('preload', preload)
  element.setAttribute('src', `${window.location.href.split('#')[0]}#/lab-playground`)
  element.setAttribute('data-testid', 'playground-lab-view')
  element.style.width = '100%'
  element.style.height = '100%'
  element.style.border = '0'
  element.style.background = '#020617'
  host.value.appendChild(element)
  view = element
}

onMounted(mount)
onBeforeUnmount(() => {
  view?.remove()
  view = null
})
</script>

<template>
  <section class="settings-card space-y-2" data-testid="playground-lab">
    <p class="brand-label text-amber-300">ЛАБОРАТОРИЯ</p>
    <p class="text-xs text-slate-400">Полный интерфейс лаборатории: сценарии, native replay, ручная проверка, звуки, данные и настройки. Тестовый профиль изолирован.</p>
    <p v-if="error" class="text-sm text-red-300" role="alert">{{ error }}</p>
    <div ref="host" class="h-[78vh] min-h-[620px] w-full overflow-hidden rounded-xl bg-slate-950" />
  </section>
</template>
