<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useCharacterAppearanceStore } from '@/stores/character-appearance'
import { createSoundPlayer } from '@/sounds'
import CharacterPicker from './CharacterPicker.vue'
import CharacterPortrait from './CharacterPortrait.vue'
import { CHARACTER_BUILD_LABELS, CHARACTER_BUILDS } from '@shared/constants/character'
import type { CharacterBuild } from '@shared/types/character'
import { useSettingsStore } from '@/stores/settings'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'

const props = withDefaults(defineProps<{ compact?: boolean; preview?: boolean }>(), { compact: false, preview: true })
const settings = useSettingsStore()
const character = useCharacterStore()
const progress = useProgressStore()
const appearance = useCharacterAppearanceStore()
const voice = createSoundPlayer({ createAudio: src => new Audio(src), getSettings: () => ({ ...settings.sound, enabled: true, voiceEnabled: true }), getCharacterId: () => appearance.packId })
onBeforeUnmount(() => voice.stop())
const builds = CHARACTER_BUILDS.filter(build => build !== 'neutral')
const error = ref('')
const busy = ref(false)
async function setBuild(build: CharacterBuild): Promise<void> {
  if (!props.compact) { appearance.build = build; return }
  busy.value = true
  error.value = ''
  try { await progress.setCharacterBuild(build) }
  catch (cause) {
    console.error('[character] build save failed', cause)
    error.value = 'Не удалось сохранить телосложение. Попробуйте ещё раз.'
  } finally { busy.value = false }
}
</script>

<template>
  <section class="character-settings" :class="{ 'settings-card': !compact }" data-testid="character-settings">
    <div v-if="preview" class="character-profile-scene" data-idle="true">
      <span class="character-badge">ФОРМА {{ character.state.stage + 1 }} / 6</span>
      <CharacterPortrait size="xl" :pack-id="compact ? settings.characterPackId : appearance.packId" :stage="character.state.stage" :branch="character.state.branch" :build="compact ? character.state.build : appearance.build" :condition="character.condition.level" />
      <p v-if="!compact && appearance.dirty" class="text-xs text-emerald-400">Примерка · ещё не сохранено</p>
      <p class="text-xs text-slate-400">{{ character.conditionLabel }}</p>
    </div>
    <div class="min-w-0 space-y-4">
      <CharacterPicker v-if="compact" compact />
      <CharacterPicker v-else v-model="appearance.packId" :disabled="appearance.busy" />
      <fieldset :disabled="busy || appearance.busy" data-testid="build-controls">
        <legend class="mb-2 text-sm font-semibold text-white">Телосложение</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="build in builds" :key="build" type="button" class="setting-chip" :data-build="build"
            :aria-pressed="(compact ? progress.characterBuild : appearance.build) === build" @click="setBuild(build)">{{ CHARACTER_BUILD_LABELS[build] }}</button>
        </div>
      </fieldset>
      <p v-if="!compact" class="text-xs leading-relaxed text-slate-400">Персонаж и телосложение меняют внешний вид. Форма и направление зависят от выполненных разминок.</p>
      <template v-if="!compact">
        <div class="flex flex-wrap gap-2"><button type="button" class="primary-action" :disabled="!appearance.dirty || appearance.busy" @click="appearance.apply">Применить</button><button type="button" class="setting-chip" :disabled="!appearance.dirty || appearance.busy" @click="appearance.cancel">Отменить</button></div>
        <p class="text-xs text-slate-400">Сохранено: {{ settings.characterPackId }} · {{ CHARACTER_BUILD_LABELS[progress.characterBuild] }}</p>
        <p v-if="appearance.error" role="alert" class="text-xs text-red-300">{{ appearance.error }}</p>
        <div class="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="settings.sound.voiceEnabled" @change="settings.setVoiceEnabled(($event.target as HTMLInputElement).checked).catch(() => error = 'Не удалось сохранить настройку голоса.')">Голос персонажа</label>
          <button type="button" class="setting-chip" @click="voice.playVoiceEvent('ready')">Послушать голос</button>
        </div>
      </template>
      <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
    </div>
  </section>
</template>
