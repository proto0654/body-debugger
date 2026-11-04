<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import type { LlmSettings } from '@shared/types/exercise-v2'

const settings = useSettingsStore()
const key = ref('')
const hasKey = ref(false)
const busy = ref(false)
const message = ref('')
const error = ref('')
async function perform(action: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try { await action() }
  catch (cause) { console.warn('[ai-connection] request failed', cause); error.value = 'Не удалось выполнить действие. Проверьте настройки сервиса и попробуйте ещё раз.' }
  finally { busy.value = false }
}
async function save(patch: Partial<LlmSettings>): Promise<void> {
  await perform(async () => {
    const result = await window.api.saveLlmConfig({ llm: patch })
    settings.llm = result.llm
    hasKey.value = result.hasKey
    message.value = 'Настройки сохранены.'
  })
}
async function saveKey(): Promise<void> {
  await perform(async () => { const result = await window.api.setLlmKey({ key: key.value.trim() }); hasKey.value = result.hasKey; key.value = ''; message.value = 'Ключ сохранён.' })
}
async function testConnection(): Promise<void> {
  await perform(async () => { const result = await window.api.testLlm(); message.value = result.message })
}
onMounted(() => { void perform(async () => { const result = await window.api.getLlmConfig(); settings.llm = result.llm; hasKey.value = result.hasKey }) })
</script>

<template>
  <section class="settings-card space-y-4" data-testid="ai-connection">
    <h2 class="text-lg font-semibold text-white">Подключение ИИ</h2>
    <p class="text-sm text-slate-400">Сервис предлагает изменения упражнений. Обычный подбор работает без ИИ.</p>
    <label class="flex items-center gap-3"><input type="checkbox" :checked="settings.llm.enabled" :disabled="busy" @change="save({ enabled: ($event.target as HTMLInputElement).checked })">Включить ИИ-помощника</label>
    <fieldset :disabled="busy || !settings.llm.enabled" class="space-y-4">
      <label class="block text-sm">Адрес сервиса<input type="url" class="profile-select mt-1 w-full" :value="settings.llm.baseUrl" @change="save({ baseUrl: ($event.target as HTMLInputElement).value.trim() })"></label>
      <label class="block text-sm">Модель<input type="text" class="profile-select mt-1 w-full" :value="settings.llm.model" @change="save({ model: ($event.target as HTMLInputElement).value.trim() })"></label>
      <label class="block text-sm">Ключ доступа · {{ hasKey ? 'сохранён' : 'не настроен' }}<input v-model="key" type="password" autocomplete="off" class="profile-select mt-1 w-full" placeholder="Вставьте ключ"></label>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="setting-chip" :disabled="!key.trim()" @click="saveKey">Сохранить ключ</button>
        <button type="button" class="setting-chip" @click="testConnection">Проверить подключение</button>
      </div>
    </fieldset>
    <p v-if="message" role="status" class="text-sm text-emerald-400">{{ message }}</p>
    <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>
  </section>
</template>
