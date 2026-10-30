<script setup lang="ts">
import { ref } from 'vue'
import { isDebugEnabled } from './is-debug-enabled'
import { useRuntimeStore } from '@/stores/runtime'
import LaboratoryPanel from './LaboratoryPanel.vue'

const props = withDefaults(defineProps<{ enabled?: boolean; now?: Date }>(), { enabled: undefined })
const runtime = useRuntimeStore()
const busy = ref(false)
const error = ref('')
async function open(): Promise<void> {
  busy.value = true
  error.value = ''
  try { await window.api.openLaboratory() }
  catch (cause) {
    console.error('[laboratory] launch failed', cause)
    error.value = 'Не удалось запустить лабораторию. Проверьте запуск dev-сборки.'
  } finally { busy.value = false }
}
</script>

<template>
  <section v-if="props.enabled ?? (isDebugEnabled() || !!runtime.laboratory)" data-testid="debug-panel">
    <LaboratoryPanel v-if="runtime.laboratory" />
    <div v-else class="settings-card space-y-4">
      <p class="brand-label text-amber-300">ВИЗУАЛЬНОЕ ТЕСТИРОВАНИЕ</p>
      <h2 class="text-xl font-semibold text-white">Лаборатория Body Debugger</h2>
      <p class="max-w-xl text-sm leading-relaxed text-slate-400">Проигрывайте истории персонажа, создавайте случайный календарь и проверяйте настоящее окно у трея. Лаборатория откроется отдельным экземпляром приложения с тестовым профилем.</p>
      <p class="text-xs text-slate-500">Обычная история и настройки остаются в своём профиле. Доступно в dev-сборке.</p>
      <button type="button" class="primary-action" data-testid="lab-launch" :disabled="busy" @click="open">{{ busy ? 'Запускаем…' : 'Открыть лабораторию ↗' }}</button>
      <p v-if="error" class="text-sm text-red-300" role="alert">{{ error }}</p>
    </div>
  </section>
</template>
