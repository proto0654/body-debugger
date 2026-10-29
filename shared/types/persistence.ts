import type { AppSettings } from './settings'
import type { UserProgress } from './progress'
import type { Session } from './session'

/** Schema version for on-disk JSON envelopes */
export const PERSISTENCE_VERSION = 1 as const

export interface PersistedEnvelope<T> {
  version: typeof PERSISTENCE_VERSION
  data: T
}

export interface DataSnapshot {
  settings: AppSettings
  progress: UserProgress
  sessions: Session[]
}
