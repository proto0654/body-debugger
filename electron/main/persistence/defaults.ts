import { DEFAULT_CHARACTER_PACK } from '../../../shared/constants/character'
import { normalizeCharacterPackId } from '../../../shared/constants/character-packs'
import { DEFAULT_SOUND_SETTINGS, normalizeSoundSettings } from '../../../shared/domain/sounds'
import { normalizeThemeId } from '../../../shared/constants/themes'
import { normalizeWeightTarget } from '../../../shared/domain/weight'
import {
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_PICKER_MODE,
  isPickerMode,
  normalizeFocus,
  normalizeIntervalMinutes
} from '../../../shared/domain/preferences'
import {
  migrateFocusV1,
  normalizeFocusV2,
  normalizeProfileShifts,
  normalizeProfileStrength
} from '../../../shared/domain/focus-v2'
import { PROFILE_STRENGTH_DEFAULT } from '../../../shared/constants/catalog-tuning'
import type { AppSettings } from '../../../shared/types/settings'
import type { AutoTuneMode, ExerciseOverride, LlmSettings } from '../../../shared/types/exercise-v2'
import type { UserProgress } from '../../../shared/types/progress'
import type {
  CharacterBranch,
  CharacterBuild,
  CharacterStage
} from '../../../shared/types/character'
import type { Session } from '../../../shared/types/session'
import type { WeightEntry } from '../../../shared/types/weight'

function defaultLlm(): LlmSettings {
  return {
    enabled: false,
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    shareProgress: false
  }
}

export function defaultSettings(): AppSettings {
  return {
    severity: 'medium',
    intervalMinutes: DEFAULT_INTERVAL_MINUTES,
    focus: { primary: null, accents: [] },
    focusV2: migrateFocusV1({ primary: null, accents: [] }),
    profileStrength: PROFILE_STRENGTH_DEFAULT,
    profileShifts: [],
    limitations: [],
    overrides: {},
    autoTune: 'suggest',
    llm: defaultLlm(),
    pickerMode: DEFAULT_PICKER_MODE,
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

  const focus = normalizeFocus(stored.focus?.primary, stored.focus?.accents)
  const storedRecord = stored as Partial<AppSettings> & Record<string, unknown>
  return {
    ...base,
    ...stored,
    intervalMinutes: normalizeIntervalMinutes(stored.intervalMinutes) ?? base.intervalMinutes,
    pickerMode: isPickerMode(stored.pickerMode) ? stored.pickerMode : base.pickerMode,
    focus,
    focusV2: normalizeFocusV2(storedRecord.focusV2, focus),
    profileStrength: normalizeProfileStrength(storedRecord.profileStrength),
    profileShifts: normalizeProfileShifts(storedRecord.profileShifts),
    limitations: normalizeLimitations(storedRecord.limitations),
    overrides: normalizeOverrides(storedRecord.overrides),
    autoTune: normalizeAutoTune(storedRecord.autoTune),
    llm: normalizeLlm(storedRecord.llm, base.llm),
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
    characterPackId: normalizeCharacterPackId(stored.characterPackId),
    weight: {
      enabled: stored.weight?.enabled ?? base.weight.enabled,
      targetKg: normalizeWeightTarget(stored.weight?.targetKg)
    }
  }
}

function normalizeAutoTune(value: unknown): AutoTuneMode {
  return value === 'off' || value === 'auto' || value === 'suggest' ? value : 'suggest'
}

function normalizeLimitations(value: unknown): AppSettings['limitations'] {
  const allowed = new Set(['neck', 'shoulder', 'wrist', 'lower_back', 'knee', 'ankle'])
  if (!Array.isArray(value)) return []
  return value.filter((item): item is AppSettings['limitations'][number] =>
    typeof item === 'string' && allowed.has(item)
  )
}

function normalizeOverrides(value: unknown): Record<string, ExerciseOverride> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, ExerciseOverride> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>
    const next: ExerciseOverride = {}
    if (entry.disabled === true) next.disabled = true
    if (typeof entry.scale === 'number' && Number.isFinite(entry.scale) && entry.scale > 0) {
      next.scale = entry.scale
    }
    if (entry.timer && typeof entry.timer === 'object') {
      next.timer = entry.timer as ExerciseOverride['timer']
    }
    out[id] = next
  }
  return out
}

function normalizeLlm(value: unknown, fallback: LlmSettings): LlmSettings {
  if (!value || typeof value !== 'object') return { ...fallback }
  const raw = value as Record<string, unknown>
  return {
    enabled: raw.enabled === true,
    baseUrl: typeof raw.baseUrl === 'string' && raw.baseUrl.trim() ? raw.baseUrl.trim() : fallback.baseUrl,
    model: typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : fallback.model,
    shareProgress: raw.shareProgress === true
  }
}

const STAGES: readonly CharacterStage[] = [0, 1, 2, 3, 4, 5]
const BRANCHES: readonly CharacterBranch[] = ['neutral', 'posture', 'power', 'mobility']
const BUILDS: readonly CharacterBuild[] = ['lean', 'average', 'stocky', 'neutral']

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
    focus: normalizeFocus(stored.focus?.primary, stored.focus?.accents)
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
