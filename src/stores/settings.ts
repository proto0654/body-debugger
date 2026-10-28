import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  AppSettings,
  ExercisePickerMode,
  InventorySettings,
  SeverityLevel
} from '@shared/types/settings'
import type { UserFocus } from '@shared/types/progress'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'

export const useSettingsStore = defineStore('settings', () => {
  const severity = ref<SeverityLevel>('medium')
  const intervalMinutes = ref(45)
  const focus = ref<UserFocus>({ primary: null, accents: [] })
  const pickerMode = ref<ExercisePickerMode>('balance')
  const inventory = ref<InventorySettings>({ enabled: false, items: [] })
  const themeId = ref('default')
  const characterPackId = ref(DEFAULT_CHARACTER_PACK)
  const reduceMotion = ref(false)
  const paused = ref(false)

  function asSettings(): AppSettings {
    return {
      severity: severity.value,
      intervalMinutes: intervalMinutes.value,
      focus: {
        primary: focus.value.primary,
        accents: [...focus.value.accents]
      },
      pickerMode: pickerMode.value,
      inventory: {
        enabled: inventory.value.enabled,
        items: [...inventory.value.items]
      },
      themeId: themeId.value,
      characterPackId: characterPackId.value,
      reduceMotion: reduceMotion.value,
      paused: paused.value
    }
  }

  function togglePause(): void {
    paused.value = !paused.value
  }

  return {
    severity,
    intervalMinutes,
    focus,
    pickerMode,
    inventory,
    themeId,
    characterPackId,
    reduceMotion,
    paused,
    asSettings,
    togglePause
  }
})
