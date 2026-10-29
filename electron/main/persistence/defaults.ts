import { DEFAULT_CHARACTER_PACK } from '../../../shared/constants/character'
import type { AppSettings } from '../../../shared/types/settings'
import type { UserProgress } from '../../../shared/types/progress'
import type { Session } from '../../../shared/types/session'

export function defaultSettings(): AppSettings {
  return {
    severity: 'medium',
    intervalMinutes: 45,
    focus: { primary: null, accents: [] },
    pickerMode: 'balance',
    inventory: { enabled: false, items: [] },
    themeId: 'default',
    characterPackId: DEFAULT_CHARACTER_PACK,
    reduceMotion: false,
    paused: false
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
