import type { AppSettings } from '../types/settings'

/** Deep-enough copy for the stored settings shape (nested objects + arrays). */
export function cloneSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    focus: {
      primary: settings.focus.primary,
      accents: [...settings.focus.accents]
    },
    focusV2: {
      zones: { ...settings.focusV2.zones },
      methods: { ...settings.focusV2.methods }
    },
    profileShifts: settings.profileShifts.map((shift) => ({ ...shift })),
    limitations: [...settings.limitations],
    overrides: { ...settings.overrides },
    llm: { ...settings.llm },
    inventory: {
      enabled: settings.inventory.enabled,
      items: [...settings.inventory.items]
    },
    sessionExtras: { enabled: settings.sessionExtras.enabled },
    ai: { enabled: settings.ai.enabled },
    photos: { enabled: settings.photos.enabled },
    sound: { ...settings.sound },
    weight: {
      enabled: settings.weight.enabled,
      targetKg: settings.weight.targetKg
    }
  }
}
