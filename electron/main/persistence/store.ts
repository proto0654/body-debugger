import type { AppSettings } from '../../../shared/types/settings'
import type { UserProgress } from '../../../shared/types/progress'
import type { Session } from '../../../shared/types/session'
import type { DataSnapshot } from '../../../shared/types/persistence'
import { computeCharacterProgress } from '../../../shared/domain/character-progress'
import { defaultProgress, defaultSessions, defaultSettings, normalizeSettings } from './defaults'
import { readJsonEnvelope, writeJsonEnvelope } from './json-file'
import { getProgressPath, getSessionsPath, getSettingsPath } from './paths'

interface PersistenceState {
  settings: AppSettings
  progress: UserProgress
  sessions: Session[]
  loaded: boolean
}

const state: PersistenceState = {
  settings: defaultSettings(),
  progress: defaultProgress(),
  sessions: defaultSessions(),
  loaded: false
}

function cloneSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    focus: {
      primary: settings.focus.primary,
      accents: [...settings.focus.accents]
    },
    inventory: {
      enabled: settings.inventory.enabled,
      items: [...settings.inventory.items]
    },
    sessionExtras: {
      enabled: settings.sessionExtras.enabled
    }
  }
}

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

export function loadPersistence(): DataSnapshot {
  state.settings = normalizeSettings(readJsonEnvelope<Partial<AppSettings>>(getSettingsPath()))
  state.progress = readJsonEnvelope<UserProgress>(getProgressPath()) ?? defaultProgress()
  state.sessions = readJsonEnvelope<Session[]>(getSessionsPath()) ?? defaultSessions()
  state.loaded = true
  return getSnapshot()
}

export function getSnapshot(): DataSnapshot {
  return {
    settings: cloneSettings(state.settings),
    progress: cloneProgress(state.progress),
    sessions: state.sessions.map((s) => ({ ...s }))
  }
}

export function updateSettings(next: AppSettings): DataSnapshot {
  state.settings = cloneSettings(next)
  writeJsonEnvelope(getSettingsPath(), state.settings)
  return getSnapshot()
}

export function updateProgress(next: UserProgress): DataSnapshot {
  state.progress = cloneProgress(next)
  writeJsonEnvelope(getProgressPath(), state.progress)
  return getSnapshot()
}

export function appendSession(session: Session): DataSnapshot {
  state.sessions = [...state.sessions, { ...session }]
  writeJsonEnvelope(getSessionsPath(), state.sessions)
  return getSnapshot()
}

/** Streak bump + character stage/branch recompute, written together on `done`. */
export function applyDoneSession(): DataSnapshot {
  const character = computeCharacterProgress(state.sessions)
  const current = state.progress.streak.current + 1

  state.progress = {
    ...cloneProgress(state.progress),
    streak: {
      current,
      max: Math.max(state.progress.streak.max, current)
    },
    characterStage: character.stage,
    characterBranch: character.branch
  }
  writeJsonEnvelope(getProgressPath(), state.progress)
  return getSnapshot()
}

export function getSettings(): AppSettings {
  return cloneSettings(state.settings)
}

export function getProgress(): UserProgress {
  return cloneProgress(state.progress)
}
