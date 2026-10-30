import { randomUUID } from 'node:crypto'
import { getLaboratoryClock } from '../../../shared/domain/clock'
import type { AppSettings } from '../../../shared/types/settings'
import type { UserProgress } from '../../../shared/types/progress'
import type { Session } from '../../../shared/types/session'
import type { WeightEntry } from '../../../shared/types/weight'
import type { DataSnapshot } from '../../../shared/types/persistence'
import { computeCharacterProgress } from '../../../shared/domain/character-progress'
import { computeStreak } from '../../../shared/domain/streak'
import { cloneSettings as copySettings } from '../../../shared/domain/settings'
import { sanitizeSessions } from '../../../shared/validation/session'
import {
  mergeSessionWeights,
  normalizeWeightEntry,
  weightEntryFromSession,
  type WeightEntryInput
} from '../../../shared/domain/weight'
import {
  defaultProgress,
  defaultSessions,
  defaultSettings,
  defaultWeights,
  normalizeProgress,
  normalizeSettings
} from './defaults'
import { readJsonEnvelope, writeJsonEnvelope } from './json-file'
import { getProgressPath, getSessionsPath, getSettingsPath, getWeightsPath } from './paths'

interface PersistenceState {
  settings: AppSettings
  progress: UserProgress
  sessions: Session[]
  weights: WeightEntry[]
  loaded: boolean
}

const state: PersistenceState = {
  settings: defaultSettings(),
  progress: defaultProgress(),
  sessions: defaultSessions(),
  weights: defaultWeights(),
  loaded: false
}

const cloneSettings = copySettings

function cloneProgress(progress: UserProgress): UserProgress {
  return {
    streak: { ...progress.streak },
    characterStage: progress.characterStage,
    characterBranch: progress.characterBranch,
    characterBuild: progress.characterBuild,
    exerciseLevels: { ...progress.exerciseLevels },
    focus: {
      primary: progress.focus.primary,
      accents: [...progress.focus.accents]
    }
  }
}

function cloneWeights(weights: readonly WeightEntry[]): WeightEntry[] {
  return weights.map((entry) => ({ ...entry }))
}

/** Stored file is untrusted: every entry is re-validated on load. */
function sanitizeStoredWeights(raw: WeightEntry[] | null): WeightEntry[] {
  if (!Array.isArray(raw)) return []

  const entries: WeightEntry[] = []
  for (const entry of raw) {
    if (!entry || typeof entry.id !== 'string' || entry.id === '') continue
    if (typeof entry.at !== 'string') continue
    const normalized = normalizeWeightEntry({
      weightKg: entry.weightKg,
      at: entry.at,
      sessionId: entry.sessionId
    })
    if (normalized) entries.push({ id: entry.id, ...normalized })
  }
  return entries
}

function writeWeights(): void {
  writeJsonEnvelope(getWeightsPath(), state.weights)
}

export function loadPersistence(): DataSnapshot {
  state.settings = normalizeSettings(readJsonEnvelope<Partial<AppSettings>>(getSettingsPath()))
  state.progress = normalizeProgress(readJsonEnvelope<UserProgress>(getProgressPath()))
  state.sessions = sanitizeSessions(readJsonEnvelope<Session[]>(getSessionsPath()))
  const character = computeCharacterProgress(state.sessions)
  state.progress.characterStage = character.stage
  state.progress.characterBranch = character.branch

  const storedWeights = sanitizeStoredWeights(
    readJsonEnvelope<WeightEntry[]>(getWeightsPath())
  )
  // One-time backfill: sessions measured before the weight layer existed.
  state.weights = mergeSessionWeights(state.sessions, storedWeights)
  if (state.weights.length !== storedWeights.length) writeWeights()

  state.loaded = true
  return getSnapshot()
}

export function getSnapshot(): DataSnapshot {
  return {
    ...(getLaboratoryClock() ? { laboratory: getLaboratoryClock() } : {}),
    settings: cloneSettings(state.settings),
    progress: getProgress(),
    sessions: state.sessions.map((s) => ({ ...s })),
    weights: cloneWeights(state.weights)
  }
}

export function updateSettings(next: AppSettings): DataSnapshot {
  // IPC payload: re-normalize so an older renderer or a hand-edited value cannot
  // write an invalid switch / theme / sound block.
  state.settings = cloneSettings(normalizeSettings(next))
  writeJsonEnvelope(getSettingsPath(), state.settings)
  return getSnapshot()
}

export function updateProgress(next: UserProgress): DataSnapshot {
  state.progress = cloneProgress(normalizeProgress(next))
  writeJsonEnvelope(getProgressPath(), state.progress)
  return getSnapshot()
}

export function appendSession(session: Session): DataSnapshot {
  if (state.sessions.some((existing) => existing.id === session.id)) return getSnapshot()
  const sessions = [...state.sessions, { ...session }]
  writeJsonEnvelope(getSessionsPath(), sessions)
  state.sessions = sessions
  try {
    recordSessionWeight(session)
  } catch (error) {
    console.error('[persistence] session saved; optional weight write failed', error)
  }
  return getSnapshot()
}

/** A completed session may carry a weight measurement (optional layer). */
function recordSessionWeight(session: Session): void {
  const entry = weightEntryFromSession(session)
  if (!entry) return
  if (state.weights.some((existing) => existing.id === entry.id)) return

  state.weights = [...state.weights, entry]
  writeWeights()
}

/**
 * Manual dashboard measurement. Invalid values and a repeated `sessionId` are
 * ignored, so the caller can retry safely.
 */
export function addWeightEntry(input: WeightEntryInput): DataSnapshot {
  const normalized = normalizeWeightEntry(input)
  if (!normalized) return getSnapshot()
  if (
    normalized.sessionId &&
    state.weights.some((entry) => entry.sessionId === normalized.sessionId)
  ) {
    return getSnapshot()
  }

  state.weights = [...state.weights, { id: randomUUID(), ...normalized }]
  writeWeights()
  return getSnapshot()
}

export function removeWeightEntry(id: string): DataSnapshot {
  if (typeof id !== 'string' || id === '') return getSnapshot()

  const target = state.weights.find((entry) => entry.id === id)
  if (!target) return getSnapshot()

  state.weights = state.weights.filter((entry) => entry.id !== id)
  writeWeights()

  // Remove the measurement from its source session too: otherwise the load-time
  // backfill would recreate it on the next launch.
  if (target.sessionId && clearSessionWeight(target.sessionId)) {
    writeJsonEnvelope(getSessionsPath(), state.sessions)
  }
  return getSnapshot()
}

function clearSessionWeight(sessionId: string): boolean {
  let changed = false

  state.sessions = state.sessions.map((session) => {
    if (session.id !== sessionId || session.weightKg === undefined) return session

    changed = true
    const next = { ...session }
    delete next.weightKg
    return next
  })
  return changed
}


/** Streak + character stage/branch recompute, written together on `done`. */
export function applyDoneSession(): DataSnapshot {
  const character = computeCharacterProgress(state.sessions)
  const streak = computeStreak(state.sessions)

  state.progress = {
    ...cloneProgress(state.progress),
    streak: {
      current: streak.current,
      max: Math.max(state.progress.streak.max, streak.max)
    },
    characterStage: character.stage,
    characterBranch: character.branch
  }
  writeJsonEnvelope(getProgressPath(), state.progress)
  return getSnapshot()
}

/**
 * Debug-only replacement of history + settings (docs/TESTING.md). Sessions are
 * re-validated and the character is recomputed so a hand-written scenario can
 * never leave inconsistent progress behind.
 */
export function applyDebugState(input: {
  sessions: unknown
  settings: Partial<AppSettings> | null | undefined
  progress: Partial<UserProgress> | null | undefined
}): DataSnapshot {
  const sessions = sanitizeSessions(input.sessions)
  const settings = normalizeSettings(input.settings)
  const normalized = normalizeProgress(input.progress)
  const character = computeCharacterProgress(sessions)

  state.sessions = sessions
  state.settings = cloneSettings(settings)
  state.progress = {
    ...cloneProgress(normalized),
    characterStage: character.stage,
    characterBranch: character.branch
  }

  writeJsonEnvelope(getSessionsPath(), state.sessions)
  writeJsonEnvelope(getSettingsPath(), state.settings)
  writeJsonEnvelope(getProgressPath(), state.progress)
  return getSnapshot()
}

export function getSettings(): AppSettings {
  return cloneSettings(state.settings)
}

export function getProgress(): UserProgress {
  const progress = cloneProgress(state.progress)
  const streak = computeStreak(state.sessions)
  progress.streak = { current: streak.current, max: Math.max(progress.streak.max, streak.max) }
  return progress
}
