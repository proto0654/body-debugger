<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PopupPreview from '@/debug/PopupPreview.vue'
import { characterReaction } from '@shared/domain/character-reaction'
import type { LabVisualPreview, LabPopupState } from '@shared/domain/laboratory-preview'
const preview = ref<LabVisualPreview | null>(null)
const error = ref('')
let unsubscribe: (() => void) | undefined
let pending = false
async function selectState(popup: LabPopupState): Promise<void> {
  if (!preview.value || pending) return
  pending = true
  error.value = ''
  const sequence = preview.value.sequence + 1
  const emotion = characterReaction(popup === 'error' ? 'active' : popup, sequence).emotion
  try { await window.api.labCommand({ action: 'visual-preview', preview: { ...preview.value, popup, emotion, sequence } }) }
  catch (cause) { console.error('[laboratory-preview] update failed', cause); error.value = 'Не удалось переключить предпросмотр.' }
  finally { pending = false }
}
async function close(): Promise<void> {
  try { await window.api.labCommand({ action: 'close-preview' }) }
  catch (cause) { console.error('[laboratory-preview] close failed', cause); error.value = 'Не удалось закрыть предпросмотр.' }
}
onMounted(async () => {
  try {
    unsubscribe = window.api.onLabChanged(state => { preview.value = state.visualPreview ?? null })
    preview.value = (await window.api.getLabState()).visualPreview ?? null
  } catch (cause) { console.error('[laboratory-preview] initialization failed', cause); error.value = 'Предпросмотр доступен только в лаборатории.' }
})
onBeforeUnmount(() => unsubscribe?.())
</script>

<template>
  <main class="relative h-screen overflow-hidden">
    <PopupPreview v-if="preview" :preview="preview" @close="close" @start="selectState('active')" @done="selectState('done')" @skip="selectState('skipped')" @snooze="selectState('snoozed')" />
    <button v-if="!preview || !['done', 'first-done', 'stage-up', 'streak', 'skipped', 'snoozed'].includes(preview.popup)" type="button" class="preview-close" aria-label="Закрыть предпросмотр" @click="close">×</button>
    <p v-if="error" role="alert" class="absolute bottom-2 inset-x-3 z-40 rounded bg-slate-950 p-2 text-xs text-red-300">{{ error }}</p>
  </main>
</template>
