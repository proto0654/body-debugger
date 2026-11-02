<script setup lang="ts">
import { computed, ref } from 'vue'
import AiProposalPanel from '@/components/ai/AiProposalPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import { usePhotosStore } from '@/stores/photos'
import { THEMES } from '@shared/constants/themes'
import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import { SOUND_CUES, SOUND_CUE_LABELS } from '@shared/domain/sounds'
import { createSoundPlayer } from '@/sounds'

const props = withDefaults(defineProps<{ group?: 'all' | 'selection' | 'presentation' | 'data' }>(), { group: 'all' })
const settings = useSettingsStore()
const error = ref('')
const busy = ref(false)
const layers = [
  { key: 'inventory', id: 'inventory-controls', title: 'Инвентарь', hint: 'Подбор учитывает оборудование, которое есть под рукой.' },
  { key: 'ai', id: 'ai-controls', title: 'Импорт из AI', hint: 'Управление наборами и генерацией — на вкладке «Упражнения».' },
  { key: 'sound', id: 'sound-controls', title: 'Звуки', hint: 'Короткие сигналы о разминке и достижениях.' },
  { key: 'weight', id: 'weight-controls', title: 'История веса', hint: 'Быстрая запись на «Сегодня», история и цель — в «Прогрессе».' },
  { key: 'photos', id: 'photo-controls', title: 'Фото прогресса', hint: 'Локальная галерея на дашборде.' }
] as const
const visibleLayers = computed(() => layers.filter(layer => props.group === 'all'
  || (props.group === 'selection' ? ['inventory', 'ai'].includes(layer.key)
    : props.group === 'data' ? ['weight', 'photos', 'ai'].includes(layer.key)
      : !['inventory', 'ai'].includes(layer.key))))
const setters = {
  sound: settings.setSoundEnabled,
  weight: settings.setWeightEnabled, photos: settings.setPhotosEnabled,
  inventory: settings.setInventoryEnabled, ai: settings.setAiEnabled
}
const preview = createSoundPlayer({ createAudio: src => new Audio(src),
  getSettings: () => ({ ...settings.sound, enabled: true, volume: Math.max(0.1, settings.sound.volume) }) })
async function save(action: () => Promise<unknown>): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { await action() }
  catch (cause) {
    console.error('[settings] save failed', cause)
    error.value = 'Не удалось сохранить настройку. Попробуйте ещё раз.'
  } finally { busy.value = false }
}
async function setLayer(key: keyof typeof setters, enabled: boolean): Promise<void> {
  await save(async () => {
    await setters[key](enabled)
    if (key === 'photos' && enabled) await usePhotosStore().refresh()
  })
}

function openExercisesTab(): void {
  window.location.hash = '?tab=exercises'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
</script>

<template>
  <div class="space-y-4">
    <section v-for="layer in visibleLayers" :key="layer.key" :data-testid="layer.id" class="settings-card space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0 flex-1"><h2 class="text-sm font-semibold text-white">{{ layer.title }}</h2><p class="mt-1 text-xs leading-relaxed text-slate-400">{{ layer.hint }}</p>
          <button v-if="layer.key === 'ai'" type="button" class="mt-2 text-xs text-emerald-400 hover:text-emerald-300" @click="openExercisesTab">Открыть «Упражнения» →</button>
        </div>
        <div class="flex gap-1"><button v-for="enabled in [false, true]" :key="String(enabled)" type="button" class="setting-chip" :disabled="busy"
          :aria-label="`${layer.title}: ${enabled ? 'включить' : 'выключить'}`" :aria-pressed="settings[layer.key].enabled === enabled"
          @click="setLayer(layer.key, enabled)">{{ enabled ? 'Вкл' : 'Выкл' }}</button></div>
      </div>
      <template v-if="layer.key === 'sound' && settings.sound.enabled">
        <label class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">Громкость {{ Math.round(settings.sound.volume * 100) }}%
          <input type="range" min="0" max="100" step="5" :value="Math.round(settings.sound.volume * 100)" :disabled="busy"
            aria-label="Громкость звуков" data-testid="sound-volume" class="w-40 accent-emerald-500" @change="save(() => settings.setSoundVolume(Number(($event.target as HTMLInputElement).value) / 100))" />
        </label>
        <label class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">Голос персонажа
          <button type="button" class="setting-chip" data-testid="sound-voice" :disabled="busy"
            :aria-label="`Голос персонажа: ${settings.sound.voiceEnabled ? 'выключить' : 'включить'}`" :aria-pressed="settings.sound.voiceEnabled"
            @click="save(() => settings.setVoiceEnabled(!settings.sound.voiceEnabled))">{{ settings.sound.voiceEnabled ? 'Вкл' : 'Выкл' }}</button>
        </label>
        <p class="text-xs leading-relaxed text-slate-400">Реплики выбранного персонажа звучат вместе с короткими сигналами тех же событий. Пакет ещё не прошёл прослушивание — если голос мешает, его можно выключить.</p>
        <details><summary class="text-xs text-slate-400 cursor-pointer">Прослушать сигналы</summary>
          <div class="mt-3 flex flex-wrap gap-2"><button v-for="cue in SOUND_CUES" :key="cue" type="button" class="setting-chip" @click="preview.play(cue)">{{ SOUND_CUE_LABELS[cue] }}</button></div>
          <p class="mt-2 text-xs text-slate-400">Прослушивание использует минимум 10% громкости, даже при нулевом уровне.</p>
        </details>
      </template>
      <div v-if="layer.key === 'inventory' && settings.inventory.enabled" class="equipment-slots" data-testid="inventory-items">
        <button v-for="item in EQUIPMENT_CATALOG" :key="item.id" type="button" class="setting-chip equipment-slot" :disabled="busy"
          :aria-pressed="settings.inventory.items.includes(item.id)" @click="save(() => settings.toggleInventoryItem(item.id))">
          <span aria-hidden="true">{{ item.emoji }}</span>{{ item.title }}
        </button>
      </div>
      <AiProposalPanel v-if="layer.key === 'ai' && settings.ai.enabled" />
    </section>
    <section v-if="group === 'all' || group === 'presentation'" class="settings-card space-y-4">
      <div data-testid="theme-controls"><h2 class="text-sm font-semibold text-white">Оформление</h2>
        <div class="mt-3 flex flex-wrap gap-2"><button v-for="theme in THEMES" :key="theme.id" type="button" class="setting-chip" :disabled="busy"
          :aria-pressed="settings.themeId === theme.id" @click="save(() => settings.setTheme(theme.id))">{{ theme.title }}</button></div>
      </div>
      <label class="flex items-center justify-between gap-3 text-sm text-slate-300">Уменьшить анимации
        <input type="checkbox" class="h-4 w-4 accent-emerald-500" :checked="settings.reduceMotion" :disabled="busy" @change="save(() => settings.setReduceMotion(($event.target as HTMLInputElement).checked))" />
      </label>
    </section>
    <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
