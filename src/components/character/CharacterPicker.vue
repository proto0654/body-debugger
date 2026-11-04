<script setup lang="ts">
import { ref } from 'vue'
import { CHARACTER_PACKS } from '@shared/constants/character-packs'
import { useSettingsStore } from '@/stores/settings'
import { resolveFrameUrl } from './frames'

const settings = useSettingsStore()
const props = withDefaults(defineProps<{ compact?: boolean; modelValue?: string }>(), { compact: false })
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
const pending = ref(false)
const error = ref('')
async function select(id: string): Promise<void> {
  if (props.modelValue !== undefined) { emit('update:modelValue', id); return }
  if (pending.value) return
  pending.value = true
  error.value = ''
  try { await settings.setCharacterPack(id) }
  catch (cause) {
    console.error('[character-picker] save failed', cause)
    error.value = 'Не удалось сохранить персонажа. Попробуйте ещё раз.'
  } finally { pending.value = false }
}
</script>

<template>
  <fieldset data-testid="character-picker" :disabled="pending">
    <legend class="mb-2 text-sm font-semibold text-white">Персонаж</legend>
    <select v-if="compact" class="profile-select" aria-label="Персонаж тестового профиля" :value="settings.characterPackId" @change="select(($event.target as HTMLSelectElement).value)">
      <option v-for="pack in CHARACTER_PACKS" :key="pack.id" :value="pack.id">{{ pack.label }}</option>
    </select>
    <div v-else class="character-picker-grid">
      <button v-for="pack in CHARACTER_PACKS" :key="pack.id" type="button"
        class="flex min-w-0 flex-col items-center rounded-xl border p-1 text-[11px] text-slate-300"
        :class="(modelValue ?? settings.characterPackId) === pack.id ? 'border-emerald-400 bg-emerald-950' : 'border-slate-700 bg-slate-950'"
        :aria-pressed="(modelValue ?? settings.characterPackId) === pack.id" :data-character-pack="pack.id" @click="select(pack.id)">
        <img :src="resolveFrameUrl(['emotion-neutral-average', 'emoji'], pack.id)" alt="" class="h-12 w-12 object-contain" />
        <span class="w-full text-center leading-snug">{{ pack.label }}</span>
      </button>
    </div>
    <p v-if="error" role="alert" class="mt-2 text-xs text-red-300">{{ error }}</p>
  </fieldset>
</template>
