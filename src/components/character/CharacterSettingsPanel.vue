<script setup lang="ts">
import { ref } from 'vue'
import CharacterPicker from './CharacterPicker.vue'
import CharacterPortrait from './CharacterPortrait.vue'
import { CHARACTER_BUILD_LABELS, CHARACTER_BUILDS } from '@shared/constants/character'
import type { CharacterBuild } from '@shared/types/character'
import { useSettingsStore } from '@/stores/settings'
import { useCharacterStore } from '@/stores/character'
import { useProgressStore } from '@/stores/progress'

withDefaults(defineProps<{ compact?: boolean; preview?: boolean }>(), { compact: false, preview: true })
const settings = useSettingsStore()
const character = useCharacterStore()
const progress = useProgressStore()
const builds = CHARACTER_BUILDS.filter(build => build !== 'neutral')
const error = ref('')
const busy = ref(false)
async function setBuild(build: CharacterBuild): Promise<void> {
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
      <CharacterPortrait size="xl" :pack-id="settings.characterPackId" :stage="character.state.stage" :branch="character.state.branch" :build="character.state.build" :condition="character.condition.level" />
      <p class="text-xs text-slate-400">{{ character.conditionLabel }}</p>
    </div>
    <div class="min-w-0 space-y-4">
      <CharacterPicker :compact="compact" />
      <fieldset :disabled="busy" data-testid="build-controls">
        <legend class="mb-2 text-sm font-semibold text-white">Телосложение</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="build in builds" :key="build" type="button" class="setting-chip" :data-build="build"
            :aria-pressed="progress.characterBuild === build" @click="setBuild(build)">{{ CHARACTER_BUILD_LABELS[build] }}</button>
        </div>
      </fieldset>
      <p v-if="!compact" class="text-xs leading-relaxed text-slate-400">Персонаж и телосложение меняют внешний вид. Форма и направление зависят от выполненных разминок.</p>
      <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
    </div>
  </section>
</template>
