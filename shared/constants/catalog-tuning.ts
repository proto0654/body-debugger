/** Tunable Catalog V2 constants (docs/CATALOG-V2.md §13). */

export const OVERLAP_PREV_WEIGHT = 0.8
export const OVERLAP_TODAY_WEIGHT = 0.55
export const METHOD_REPEAT_MULT = 0.75
export const NEGLECT_CAP = 1.8
export const NEGLECT_DAYS = 7

/** Level multipliers: − / 0 / + / ++ */
export const LEVEL_MULT: Record<-1 | 0 | 1 | 2, number> = {
  [-1]: 0.6,
  0: 1.0,
  1: 1.25,
  2: 1.6
}

export const DOSE_EXPONENT = 0.35
export const DOSE_BASE_INTERVAL = 45
export const INTENSITY_CAP_SHORT = 20
export const INTENSITY_CAP_LONG = 60

export const TIMER_FLOOR_MOBILITY = 20
export const TIMER_FLOOR_LOAD = 30

export const COVERAGE_THRESHOLD = 6
export const SHARE_WINDOW_DAYS = 14
export const BOOST_CLAMP_MIN = 0.7
export const BOOST_CLAMP_MAX = 1.8
export const PROFILE_STRENGTH_DEFAULT = 0.7
export const PROFILE_STRENGTH_FOCUS_SCALE = 1.5
export const PROFILE_STRENGTH_MAX = 1.5

export const PUSH_NEGLECT_MULT = 3
export const PROFILE_SHIFT_MAX_DAYS = 28
export const TUNE_TIMER_GUARD = 0.25
export const HINT_WINDOW = 5
export const HINT_SKIP_THRESHOLD = 3
export const PERSONAL_SCALE_STEP = 0.1
export const CHANGESET_HISTORY_LIMIT = 30
export const LLM_MAX_EXERCISES = 24
export const LLM_MAX_OPS = 30
