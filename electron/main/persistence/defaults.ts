import { DEFAULT_CHARACTER_PACK } from '../../../shared/constants/character'
import { DEFAULT_SOUND_SETTINGS, normalizeSoundSettings } from '../../../shared/domain/sounds'
import { normalizeThemeId } from '../../../shared/constants/themes'
import { normalizeWeightTarget } from '../../../shared/domain/weight'
import type { AppSettings } from '../../../shared/types/settings'
import type { FocusDirection, UserProgress } from '../../../shared/types/progress'
import type {
  CharacterBranch,
  CharacterBuild,
  CharacterStage
} from '../../../shared/types/character'
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
    ai: { enabled: false },
    photos: { enabled: false },
    sound: { ...DEFAULT_SOUND_SETTINGS },
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
      accents: Array.isArray(stored.focus?.accents)
        ? [...stored.focus.accents]
        : [...base.focus.accents]
    },
    inventory: {
      ...base.inventory,
      ...stored.inventory,
      items: Array.isArray(stored.inventory?.items)
        ? [...stored.inventory.items]
        : [...base.inventory.items]
    },
    sessionExtras: {
      ...base.sessionExtras,
      ...stored.sessionExtras
    },
    ai: { enabled: stored.ai?.enabled === true },
    photos: { enabled: stored.photos?.enabled === true },
    sound: normalizeSoundSettings(stored.sound),
    themeId: normalizeThemeId(stored.themeId),
    weight: {
      enabled: stored.weight?.enabled ?? base.weight.enabled,
      targetKg: normalizeWeightTarget(stored.weight?.targetKg)
    }
  }
}

const STAGES: readonly CharacterStage[] = [0, 1, 2, 3, 4, 5]
const BRANCHES: readonly CharacterBranch[] = ['neutral', 'posture', 'power', 'mobility']
const BUILDS: readonly CharacterBuild[] = ['lean', 'average', 'stocky', 'neutral']
const FOCUS_DIRECTIONS: readonly FocusDirection[] = [
  'mobility',
  'light_athletics',
  'strength',
  'body_belts',
  'striking',
  'balance'
]

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0
}

/** Stored progress is untrusted: unknown keys and out-of-range values fall back. */
export function normalizeProgress(stored: Partial<UserProgress> | null | undefined): UserProgress {
  const base = defaultProgress()
  if (!stored) return base

  const current = count(stored.streak?.current)
  const max = Math.max(current, count(stored.streak?.max))
  const primary = FOCUS_DIRECTIONS.includes(stored.focus?.primary as FocusDirection)
    ? (stored.focus?.primary as FocusDirection)
    : null
  const rawAccents = Array.isArray(stored.focus?.accents) ? stored.focus.accents : []
  const accents = rawAccents.filter(
    (accent, index, all): accent is FocusDirection =>
      FOCUS_DIRECTIONS.includes(accent) && all.indexOf(accent) === index
  )

  const rawLevels =
    stored.exerciseLevels && typeof stored.exerciseLevels === 'object'
      ? stored.exerciseLevels
      : {}
  const levels: UserProgress['exerciseLevels'] = {}
  for (const [id, level] of Object.entries(rawLevels)) {
    if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
      levels[id] = Math.floor(level)
    }
  }

  return {
    streak: { current, max },
    characterStage: STAGES.includes(stored.characterStage as CharacterStage)
      ? (stored.characterStage as CharacterStage)
      : base.characterStage,
    characterBranch: BRANCHES.includes(stored.characterBranch as CharacterBranch)
      ? (stored.characterBranch as CharacterBranch)
      : base.characterBranch,
    characterBuild: BUILDS.includes(stored.characterBuild as CharacterBuild)
      ? (stored.characterBuild as CharacterBuild)
      : base.characterBuild,
    exerciseLevels: levels,
    focus: { primary, accents }
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
