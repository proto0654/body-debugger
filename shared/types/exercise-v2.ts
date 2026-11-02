/** Catalog V2 exercise model (docs/CATALOG-V2.md §2). */

export type Zone = 'upper' | 'core' | 'lower' | 'full'
export type Method = 'mobility' | 'strength' | 'cardio' | 'striking' | 'balance'
export type Limitation = 'neck' | 'shoulder' | 'wrist' | 'lower_back' | 'knee' | 'ankle'
export type FocusLevel = -1 | 0 | 1 | 2
export type ExerciseStatus = 'active' | 'archived'
export type ExerciseSourceKind = 'shipped' | 'user' | 'llm'
export type Posture = 'seated' | 'standing' | 'floor'
export type Intensity = 1 | 2 | 3 | 4 | 5

export interface ExerciseTimer {
  minSec: number
  defaultSec: number
  maxSec: number
  perSide?: boolean
}

export interface ExerciseReps {
  min: number
  max: number
}

export interface ExerciseContext {
  posture: Posture
  quiet: boolean
  noSweat: boolean
}

export interface ExerciseSource {
  kind: ExerciseSourceKind
  batchId?: string
  model?: string
  createdAt?: string
}

export interface ExerciseV2 {
  id: string
  title: string
  description: string
  method: Method
  zones: Partial<Record<Zone, number>>
  intensity: Intensity
  difficulty: Intensity
  timer: ExerciseTimer
  reps?: ExerciseReps
  equipment?: string[]
  context: ExerciseContext
  avoidIf?: Limitation[]
  modificationOf?: string
  emojiFallback: string
  imageKey?: string
  status: ExerciseStatus
  source: ExerciseSource
}

/** Derived fields kept for backward compatibility with v1 consumers. */
export interface ExerciseV2Derived {
  dominantZone: Zone
  group: 'upper' | 'lower' | 'full' | 'equipment'
  category: string
  durationSec: number
}

export type ExerciseV2Resolved = ExerciseV2 & ExerciseV2Derived

export interface FocusV2 {
  zones: Record<Zone, FocusLevel>
  methods: Record<Method, FocusLevel>
}

export interface LlmSettings {
  enabled: boolean
  baseUrl: string
  model: string
  shareProgress: boolean
}

export type AutoTuneMode = 'off' | 'suggest' | 'auto'

export interface ProfileShift {
  axis: 'zone' | 'method'
  key: string
  level: -1 | 1 | 2
  until: string
  changesetId: string
}

export interface ExerciseOverride {
  disabled?: boolean
  /** Personal dose scale; 1 = default. */
  scale?: number
  /** Scale before the last accept/auto apply (for undo). */
  previousScale?: number
  /** ISO time when scale last changed; used for hint cooldown. */
  scaledAt?: string
  timer?: Partial<ExerciseTimer>
}

/** Accepted personal-dose changes shown on «Наборы». */
export interface ScaleHistoryEntry {
  exerciseId: string
  fromScale: number
  toScale: number
  at: string
  source: 'suggest' | 'auto' | 'undo'
}

export interface CatalogBatch {
  id: string
  name: string
  kind: 'legacy-import' | 'llm' | 'user' | 'shipped'
  createdAt: string
  model?: string
  enabled: boolean
  count: number
}

export interface CatalogFile {
  version: 2
  exercises: ExerciseV2[]
  batches: CatalogBatch[]
}
