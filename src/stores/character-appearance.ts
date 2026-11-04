import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useSettingsStore } from './settings'
import { useProgressStore } from './progress'
import type { CharacterBuild } from '@shared/types/character'

export const useCharacterAppearanceStore = defineStore('characterAppearance', () => {
  const settings = useSettingsStore()
  const progress = useProgressStore()
  const packId = ref(settings.characterPackId)
  const build = ref<CharacterBuild>(progress.characterBuild)
  const busy = ref(false)
  const error = ref('')
  const dirty = computed(() => packId.value !== settings.characterPackId || build.value !== progress.characterBuild)
  watch(() => settings.characterPackId, (next, previous) => { if (!busy.value && packId.value === previous) packId.value = next })
  watch(() => progress.characterBuild, (next, previous) => { if (!busy.value && build.value === previous) build.value = next })
  function cancel(): void {
    packId.value = settings.characterPackId
    build.value = progress.characterBuild
    error.value = ''
  }
  async function apply(): Promise<void> {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      await settings.setCharacterPack(packId.value)
      await progress.setCharacterBuild(build.value)
    } catch (cause) {
      console.warn('[character-appearance] save failed', cause)
      error.value = 'Не всё удалось сохранить. Сохранённые значения показаны ниже; повторите применение оставшихся изменений.'
    } finally { busy.value = false }
  }
  return { packId, build, busy, error, dirty, apply, cancel }
})
