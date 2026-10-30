<script setup lang="ts">
import { ref } from 'vue'
import AiProposalPanel from '@/components/ai/AiProposalPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import { usePhotosStore } from '@/stores/photos'
import { THEMES } from '@shared/constants/themes'
import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import { SEVERITY_LABELS, SEVERITY_ORDER } from '@shared/domain/severity'

const settings = useSettingsStore()
const error = ref('')
const layers = [
  { key: 'sessionExtras', id: 'extras-controls', title: 'Детали в попапе', hint: 'Повторы и ощущения — только когда хочется записать.' },
  { key: 'sound', id: 'sound-controls', title: 'Звуки', hint: 'Короткие сигналы о разминке и достижениях.' },
  { key: 'weight', id: 'weight-controls', title: 'История веса', hint: 'Личные измерения и цель на главном экране.' },
  { key: 'photos', id: 'photo-controls', title: 'Фото прогресса', hint: 'Локальная галерея и фото к выполненной разминке.' },
  { key: 'inventory', id: 'inventory-controls', title: 'Инвентарь', hint: 'Упражнения только с тем, что есть под рукой.' },
  { key: 'ai', id: 'ai-controls', title: 'Импорт из AI', hint: 'Вставить предложение и лично утвердить упражнение.' }
] as const
const setters = {
  sessionExtras: settings.setSessionExtrasEnabled,
  sound: settings.setSoundEnabled,
  weight: settings.setWeightEnabled,
  photos: settings.setPhotosEnabled,
  inventory: settings.setInventoryEnabled,
  ai: settings.setAiEnabled
}

async function setLayer(key: keyof typeof setters, enabled: boolean): Promise<void> {
  error.value = ''
  try {
    await setters[key](enabled)
    if (key === 'photos' && enabled) await usePhotosStore().refresh()
  } catch (cause) {
    console.error('[settings] failed to save optional layer', cause)
    error.value = 'Не удалось сохранить настройку. Попробуйте ещё раз.'
  }
}

function setVolume(event: Event): void {
  void settings.setSoundVolume(Number((event.target as HTMLInputElement).value) / 100)
}
</script>

<template>
  <section class="settings-card space-y-5">
    <div>
      <h2 class="text-sm font-semibold text-white">Комфортный режим</h2>
      <p class="mt-1 text-xs text-slate-400">Настрой поведение под себя. Любой режим начинается с кнопки «Начать».</p>
    </div>
    <div class="space-y-2">
      <p class="text-xs text-slate-400">Подтверждение выполнения</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="severity in SEVERITY_ORDER" :key="severity" type="button"
          class="setting-chip" :class="{ 'is-active': settings.severity === severity }"
          :aria-pressed="settings.severity === severity" @click="settings.setSeverity(severity)">
          {{ SEVERITY_LABELS[severity] }}
        </button>
      </div>
      <p class="text-xs text-slate-500">Мягкая — довериться себе. Средняя — пройти таймер. Жёсткая — ещё и удержать «Готово».</p>
    </div>
    <div class="space-y-2" data-testid="theme-controls">
      <p class="text-xs text-slate-400">Оформление</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="theme in THEMES" :key="theme.id" type="button"
          class="setting-chip" :class="{ 'is-active': settings.themeId === theme.id }"
          :aria-pressed="settings.themeId === theme.id" @click="settings.setTheme(theme.id)">
          {{ theme.title }}
        </button>
      </div>
    </div>
    <label class="flex items-center justify-between gap-3 text-sm text-slate-300">
      Уменьшить анимации
      <input type="checkbox" class="h-4 w-4 accent-emerald-500" :checked="settings.reduceMotion"
        @change="settings.setReduceMotion(($event.target as HTMLInputElement).checked)" />
    </label>
  </section>

  <section class="settings-card space-y-4">
    <div>
      <h2 class="text-sm font-semibold text-white">Дополнения</h2>
      <p class="mt-1 text-xs text-slate-400">Основной цикл работает сам по себе. Добавляй только нужное.</p>
    </div>
    <div v-for="layer in layers" :key="layer.key" :data-testid="layer.id"
      class="flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
      <div>
        <p class="text-sm text-slate-200">{{ layer.title }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ layer.hint }}</p>
      </div>
      <div class="flex shrink-0 gap-1">
        <button v-for="enabled in [false, true]" :key="String(enabled)" type="button"
          class="setting-chip" :class="{ 'is-active': settings[layer.key].enabled === enabled }"
          :aria-label="`${layer.title}: ${enabled ? 'включить' : 'выключить'}`"
          :aria-pressed="settings[layer.key].enabled === enabled" @click="setLayer(layer.key, enabled)">
          {{ enabled ? 'Вкл' : 'Выкл' }}
        </button>
      </div>
    </div>
    <label v-if="settings.sound.enabled" class="flex items-center justify-between gap-4 text-xs text-slate-400">
      Громкость {{ Math.round(settings.sound.volume * 100) }}%
      <input type="range" min="0" max="100" step="5" :value="Math.round(settings.sound.volume * 100)"
        aria-label="Громкость звуков" data-testid="sound-volume" class="w-40 accent-emerald-500" @change="setVolume" />
    </label>
    <div v-if="settings.inventory.enabled" class="flex flex-wrap gap-2" data-testid="inventory-items">
      <button v-for="item in EQUIPMENT_CATALOG" :key="item.id" type="button" class="setting-chip"
        :class="{ 'is-active': settings.inventory.items.includes(item.id) }"
        :aria-pressed="settings.inventory.items.includes(item.id)" @click="settings.toggleInventoryItem(item.id)">
        {{ item.emoji }} {{ item.title }}
      </button>
    </div>
    <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
  </section>
  <AiProposalPanel v-if="settings.ai.enabled" />
</template>
