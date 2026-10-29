import { DEFAULT_CHARACTER_PACK } from '../../../shared/constants/character'
import { normalizeWeightTarget } from '../../../shared/domain/weight'
import type { AppSettings } from '../../../shared/types/settings'
import type { UserProgress } from '../../../shared/types/progress'
import type { Session } from '../../../shared/types/session'
import type { WeightEntry } from '../../../shared/types/weight'

export function defaultSettings(): AppSettings {
  return {
    severity: 'medium',
    intervalMinutes: 45,
    focus: { primary: null, accents: [] },
    pickerMode: 'balance',
    inventory: { enabled: false, items: [] },
    sessionExtras: { enabled: false },
    weight: { enabled: false, targetKg: null },
    themeId: 'default',
    characterPackId: DEFAULT_CHARACTER_PACK,
    reduceMotion: false,
    paused: false
  }
}

/**
 * Merge a stored settings file with the current defaults.
 *
 * Settings are stored as one JSON object, so a field added in a later version is
 * absent from older files. Nested objects and their arrays are rebuilt against
 * the defaults instead of being spread blindly.
 */
export function normalizeSettings(stored: Partial<AppSettings> | null | undefined): AppSettings {
  const base = defaultSettings()
  if (!stored) return base

  return {
    ...base,
    ...stored,
    focus: {
      ...base.focus,
      ...stored.focus,
      accents: [...(stored.focus?.accents ?? base.focus.accents)]
    },
    inventory: {
      ...base.inventory,
      ...stored.inventory,
      items: [...(stored.inventory?.items ?? base.inventory.items)]
    },
    sessionExtras: {
      ...base.sessionExtras,
      ...stored.sessionExtras
    },
    weight: {
      enabled: stored.weight?.enabled ?? base.weight.enabled,
      targetKg: normalizeWeightTarget(stored.weight?.targetKg)
    }
  }
}

export function defaultProgress(): UserProgress {
  return {
    streak: { current: 0, max: 0 },
    characterStage: 0,
    characterBranch: 'neutral',
    characterBuild: 'average',
    exerciseLevels: {},
    focus: { primary: null, accents: [] }
  }
}

export function defaultSessions(): Session[] {
  return []
}

export function defaultWeights(): WeightEntry[] {
  return []
}
