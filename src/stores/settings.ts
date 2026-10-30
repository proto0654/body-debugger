import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  AppSettings,
  ExercisePickerMode,
  InventorySettings,
  SessionExtrasSettings,
  AiSettings,
  PhotoSettings,
  SeverityLevel,
  SoundSettings
} from '@shared/types/settings'
import type { FocusDirection, UserFocus } from '@shared/types/progress'
import type { WeightSettings } from '@shared/types/weight'
import { normalizeWeightTarget } from '@shared/domain/weight'
import {
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_PICKER_MODE,
  isPickerMode,
  isSameFocus,
  normalizeFocus,
  normalizeIntervalMinutes
} from '@shared/domain/preferences'
import {
  DEFAULT_SOUND_SETTINGS,
  isSoundPackId,
  normalizeSoundSettings
} from '@shared/domain/sounds'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'
import { isEquipmentId } from '@shared/constants/equipment'
import { normalizeThemeId } from '@shared/constants/themes'

export const useSettingsStore = defineStore('settings', () => {
  const severity = ref<SeverityLevel>('medium')
  const intervalMinutes = ref(DEFAULT_INTERVAL_MINUTES)
  const focus = ref<UserFocus>({ primary: null, accents: [] })
  const pickerMode = ref<ExercisePickerMode>(DEFAULT_PICKER_MODE)
  const inventory = ref<InventorySettings>({ enabled: false, items: [] })
  const sessionExtras = ref<SessionExtrasSettings>({ enabled: false })
  const ai = ref<AiSettings>({ enabled: false })
  const photos = ref<PhotoSettings>({ enabled: false })
  const sound = ref<SoundSettings>({ ...DEFAULT_SOUND_SETTINGS })
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
      ai: { enabled: ai.value.enabled },
      photos: { enabled: photos.value.enabled },
      sound: { ...sound.value },
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
    intervalMinutes.value = normalizeIntervalMinutes(next.intervalMinutes) ?? DEFAULT_INTERVAL_MINUTES
    focus.value = normalizeFocus(next.focus.primary, next.focus.accents)
    pickerMode.value = isPickerMode(next.pickerMode) ? next.pickerMode : DEFAULT_PICKER_MODE
    inventory.value = {
      enabled: next.inventory.enabled,
      items: [...next.inventory.items]
    }
    sessionExtras.value = {
      enabled: next.sessionExtras?.enabled ?? false
    }
    ai.value = { enabled: next.ai?.enabled === true }
    photos.value = { enabled: next.photos?.enabled === true }
    sound.value = normalizeSoundSettings(next.sound)
    weight.value = {
      enabled: next.weight?.enabled ?? false,
      targetKg: next.weight?.targetKg ?? null
    }
    themeId.value = normalizeThemeId(next.themeId)
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

  /** Whole minutes inside the documented bounds; invalid input is ignored. */
  async function setIntervalMinutes(next: number): Promise<void> {
    const minutes = normalizeIntervalMinutes(next)
    if (minutes === null || minutes === intervalMinutes.value) return
    intervalMinutes.value = minutes
    await persist()
  }

  async function setPickerMode(next: ExercisePickerMode): Promise<void> {
    if (!isPickerMode(next) || pickerMode.value === next) return
    pickerMode.value = next
    await persist()
  }

  /** `null` clears the primary direction; accents never repeat it. */
  async function setFocusPrimary(next: FocusDirection | null): Promise<void> {
    const focusNext = normalizeFocus(next, focus.value.accents)
    if (isSameFocus(focus.value, focusNext)) return
    focus.value = focusNext
    await persist()
  }

  async function toggleFocusAccent(direction: FocusDirection): Promise<void> {
    if (focus.value.primary === direction) return

    const accents = focus.value.accents.includes(direction)
      ? focus.value.accents.filter((accent) => accent !== direction)
      : [...focus.value.accents, direction]
    const focusNext = normalizeFocus(focus.value.primary, accents)
    if (isSameFocus(focus.value, focusNext)) return

    focus.value = focusNext
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

  async function setTheme(next: string): Promise<void> {
    const normalized = normalizeThemeId(next)
    if (next !== normalized || themeId.value === normalized) return
    themeId.value = normalized
    await persist()
  }

  async function setInventoryEnabled(next: boolean): Promise<void> {
    if (inventory.value.enabled === next) return
    inventory.value = { ...inventory.value, items: [...inventory.value.items], enabled: next }
    await persist()
  }

  /** Unknown equipment ids are ignored; the order follows the catalog. */
  async function toggleInventoryItem(id: string): Promise<void> {
    if (!isEquipmentId(id)) return

    const owned = inventory.value.items.includes(id)
    inventory.value = {
      enabled: inventory.value.enabled,
      items: owned
        ? inventory.value.items.filter((item) => item !== id)
        : [...inventory.value.items, id]
    }
    await persist()
  }

  async function setAiEnabled(next: boolean): Promise<void> {
    if (ai.value.enabled === next) return
    ai.value = { enabled: next }
    await persist()
  }

  async function setPhotosEnabled(next: boolean): Promise<void> {
    if (photos.value.enabled === next) return
    photos.value = { enabled: next }
    await persist()
  }

  async function setSoundEnabled(next: boolean): Promise<void> {
    if (sound.value.enabled === next) return
    sound.value = { ...sound.value, enabled: next }
    await persist()
  }

  /** Slider input; out-of-range values clamp instead of being rejected. */
  async function setSoundVolume(next: number): Promise<void> {
    const volume = normalizeSoundSettings({ ...sound.value, volume: next }).volume
    if (sound.value.volume === volume) return
    sound.value = { ...sound.value, volume }
    await persist()
  }

  /** Unknown pack ids are ignored so a stale UI cannot break playback. */
  async function setSoundPack(next: string): Promise<void> {
    if (!isSoundPackId(next) || sound.value.packId === next) return
    sound.value = { ...sound.value, packId: next }
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
    ai,
    photos,
    sound,
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
    setIntervalMinutes,
    setPickerMode,
    setFocusPrimary,
    toggleFocusAccent,
    setReduceMotion,
    setSessionExtrasEnabled,
    setTheme,
    setInventoryEnabled,
    setAiEnabled,
    setPhotosEnabled,
    toggleInventoryItem,
    setSoundEnabled,
    setSoundVolume,
    setSoundPack,
    setWeightEnabled,
    setWeightTarget
  }
})
