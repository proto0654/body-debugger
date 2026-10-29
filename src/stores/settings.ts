import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  AppSettings,
  ExercisePickerMode,
  InventorySettings,
  SessionExtrasSettings,
  SeverityLevel
} from '@shared/types/settings'
import type { UserFocus } from '@shared/types/progress'
import type { WeightSettings } from '@shared/types/weight'
import { normalizeWeightTarget } from '@shared/domain/weight'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'

export const useSettingsStore = defineStore('settings', () => {
  const severity = ref<SeverityLevel>('medium')
  const intervalMinutes = ref(45)
  const focus = ref<UserFocus>({ primary: null, accents: [] })
  const pickerMode = ref<ExercisePickerMode>('balance')
  const inventory = ref<InventorySettings>({ enabled: false, items: [] })
  const sessionExtras = ref<SessionExtrasSettings>({ enabled: false })
  const weight = ref<WeightSettings>({ enabled: false, targetKg: null })
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
      sessionExtras: {
        enabled: sessionExtras.value.enabled
      },
      weight: {
        enabled: weight.value.enabled,
        targetKg: weight.value.targetKg
      },
      themeId: themeId.value,
      characterPackId: characterPackId.value,
      reduceMotion: reduceMotion.value,
      paused: paused.value
    }
  }

  function hydrate(next: AppSettings): void {
    severity.value = next.severity
    intervalMinutes.value = next.intervalMinutes
    focus.value = {
      primary: next.focus.primary,
      accents: [...next.focus.accents]
    }
    pickerMode.value = next.pickerMode
    inventory.value = {
      enabled: next.inventory.enabled,
      items: [...next.inventory.items]
    }
    sessionExtras.value = {
      enabled: next.sessionExtras?.enabled ?? false
    }
    weight.value = {
      enabled: next.weight?.enabled ?? false,
      targetKg: next.weight?.targetKg ?? null
    }
    themeId.value = next.themeId
    characterPackId.value = next.characterPackId
    reduceMotion.value = next.reduceMotion
    paused.value = next.paused
  }

  async function persist(): Promise<void> {
    if (!window.api?.saveSettings) return
    const snapshot = await window.api.saveSettings(asSettings())
    hydrate(snapshot.settings)
  }

  async function togglePause(): Promise<void> {
    paused.value = !paused.value
    await persist()
  }

  async function setSeverity(next: SeverityLevel): Promise<void> {
    if (severity.value === next) return
    severity.value = next
    await persist()
  }

  async function setReduceMotion(next: boolean): Promise<void> {
    if (reduceMotion.value === next) return
    reduceMotion.value = next
    await persist()
  }

  async function setSessionExtrasEnabled(next: boolean): Promise<void> {
    if (sessionExtras.value.enabled === next) return
    sessionExtras.value = { enabled: next }
    await persist()
  }

  /** Toggles the optional weight history card on the dashboard. */
  async function setWeightEnabled(next: boolean): Promise<void> {
    if (weight.value.enabled === next) return
    weight.value = { ...weight.value, enabled: next }
    await persist()
  }

  /** `null` clears the goal; out-of-range values are ignored. */
  async function setWeightTarget(targetKg: number | null): Promise<void> {
    const normalized = targetKg === null ? null : normalizeWeightTarget(targetKg)
    if (targetKg !== null && normalized === null) return
    if (weight.value.targetKg === normalized) return

    weight.value = { ...weight.value, targetKg: normalized }
    await persist()
  }

  return {
    severity,
    intervalMinutes,
    focus,
    pickerMode,
    inventory,
    sessionExtras,
    weight,
    themeId,
    characterPackId,
    reduceMotion,
    paused,
    asSettings,
    hydrate,
    persist,
    togglePause,
    setSeverity,
    setReduceMotion,
    setSessionExtrasEnabled,
    setWeightEnabled,
    setWeightTarget
  }
})
