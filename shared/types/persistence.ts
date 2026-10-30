import type { AppSettings } from './settings'
import type { UserProgress } from './progress'
import type { Session } from './session'
import type { WeightEntry } from './weight'
import type { LaboratoryClock } from '../domain/clock'

/** Schema version for on-disk JSON envelopes */
export const PERSISTENCE_VERSION = 1 as const

export interface PersistedEnvelope<T> {
  version: typeof PERSISTENCE_VERSION
  data: T
}

export interface DataSnapshot {
  /** Runtime-only; absent from normal profiles and never stored in data envelopes. */
  laboratory?: LaboratoryClock
  settings: AppSettings
  progress: UserProgress
  sessions: Session[]
  /** Optional weight layer; empty until the user logs a measurement */
  weights: WeightEntry[]
}
