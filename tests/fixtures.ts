import type { Exercise } from '@shared/types/exercise'
import type { UserFocus } from '@shared/types/progress'
import type { Session, SessionStatus } from '@shared/types/session'
import type { AppSettings } from '@shared/types/settings'
import type { WeightEntry } from '@shared/types/weight'

/** Fixed reference point so day-based rules stay deterministic. */
export const NOW = new Date('2026-10-30T12:00:00+03:00')

const DAY_MS = 86_400_000

/** ISO timestamp `daysAgo` days before {@link NOW}. */
export function daysAgo(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()
}

export function makeExercise(overrides: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise {
  return {
    title: `Exercise ${overrides.id}`,
    description: 'Test exercise',
    durationSec: 30,
    difficulty: 1,
    category: 'neck',
    group: 'upper',
    emojiFallback: '💪',
    ...overrides
  }
}

let sessionCounter = 0

export function makeSession(
  overrides: Partial<Session> & Pick<Session, 'exerciseId'>
): Session {
  sessionCounter += 1
  const triggeredAt = overrides.triggeredAt ?? daysAgo(0)
  return {
    id: `session-${sessionCounter}`,
    status: 'done' as SessionStatus,
    durationSec: 30,
    triggeredAt,
    completedAt: triggeredAt,
    ...overrides
  }
}

export function makeFocus(overrides: Partial<UserFocus> = {}): UserFocus {
  return { primary: null, accents: [], ...overrides }
}

let weightCounter = 0

export function makeWeightEntry(
  overrides: Partial<WeightEntry> & Pick<WeightEntry, 'weightKg'>
): WeightEntry {
  weightCounter += 1
  return {
    id: `weight-${weightCounter}`,
    at: daysAgo(0),
    ...overrides
  }
}

export function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    severity: 'medium',
    intervalMinutes: 45,
    focus: makeFocus(),
    focusV2: {
      zones: { upper: 0, core: 0, lower: 0, full: 0 },
      methods: { mobility: 0, strength: 0, cardio: 0, striking: 0, balance: 0 }
    },
    profileStrength: 0.7,
    profileShifts: [],
    limitations: [],
    overrides: {},
    autoTune: 'suggest',
    llm: {
      enabled: false,
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      shareProgress: false
    },
    pickerMode: 'balance',
    inventory: { enabled: false, items: [] },
    sessionExtras: { enabled: false },
    ai: { enabled: false },
    photos: { enabled: false },
    sound: { enabled: false, volume: 0.4, packId: 'default', voiceEnabled: true },
    weight: { enabled: false, targetKg: null },
    themeId: 'default',
    characterPackId: 'desk-hulk',
    reduceMotion: false,
    paused: false,
    ...overrides
  }
}

/** Deterministic RNG (mulberry32) so distribution checks never flake. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function countPicks(
  picks: Exercise[],
  predicate: (exercise: Exercise) => boolean
): number {
  return picks.filter(predicate).length
}
