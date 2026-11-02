import { METHODS, ZONES } from '../constants/catalog-axes'
import { PROFILE_STRENGTH_DEFAULT, PROFILE_SHIFT_MAX_DAYS } from '../constants/catalog-tuning'
import type { FocusDirection, UserFocus } from '../types/progress'
import type {
  FocusLevel,
  FocusV2,
  Method,
  ProfileShift,
  Zone
} from '../types/exercise-v2'
import { isMethod, isZone } from '../constants/catalog-axes'

export function emptyFocusV2(): FocusV2 {
  return {
    zones: { upper: 0, core: 0, lower: 0, full: 0 },
    methods: { mobility: 0, strength: 0, cardio: 0, striking: 0, balance: 0 }
  }
}

/** Old focus.primary → ++, each accent → + (CATALOG-V2 §1.1). */
export function migrateFocusV1(focus: UserFocus): FocusV2 {
  const next = emptyFocusV2()
  applyDirection(next, focus.primary, 2)
  for (const accent of focus.accents) applyDirection(next, accent, 1)
  return next
}

function applyDirection(focus: FocusV2, direction: FocusDirection | null, level: FocusLevel): void {
  if (!direction) return
  switch (direction) {
    case 'mobility':
      focus.methods.mobility = maxLevel(focus.methods.mobility, level)
      break
    case 'light_athletics':
      focus.methods.cardio = maxLevel(focus.methods.cardio, level)
      break
    case 'strength':
      focus.methods.strength = maxLevel(focus.methods.strength, level)
      break
    case 'striking':
      focus.methods.striking = maxLevel(focus.methods.striking, level)
      break
    case 'balance':
      focus.methods.balance = maxLevel(focus.methods.balance, level)
      break
    case 'body_belts':
      focus.zones.upper = maxLevel(focus.zones.upper, level)
      focus.zones.lower = maxLevel(focus.zones.lower, level)
      break
  }
}

function maxLevel(current: FocusLevel, next: FocusLevel): FocusLevel {
  return (current > next ? current : next) as FocusLevel
}

export function normalizeFocusLevel(value: unknown): FocusLevel {
  if (value === -1 || value === 0 || value === 1 || value === 2) return value
  return 0
}

export function normalizeFocusV2(raw: unknown, fallbackV1?: UserFocus): FocusV2 {
  if (raw && typeof raw === 'object') {
    const data = raw as Record<string, unknown>
    const zonesRaw = data.zones && typeof data.zones === 'object' ? (data.zones as Record<string, unknown>) : {}
    const methodsRaw =
      data.methods && typeof data.methods === 'object' ? (data.methods as Record<string, unknown>) : {}
    const focus = emptyFocusV2()
    for (const zone of ZONES) focus.zones[zone] = normalizeFocusLevel(zonesRaw[zone])
    for (const method of METHODS) focus.methods[method] = normalizeFocusLevel(methodsRaw[method])
    return focus
  }
  return fallbackV1 ? migrateFocusV1(fallbackV1) : emptyFocusV2()
}

export function normalizeProfileStrength(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return PROFILE_STRENGTH_DEFAULT
  return Math.min(1, Math.max(0, value))
}

export function normalizeProfileShifts(
  raw: unknown,
  now = Date.now()
): ProfileShift[] {
  if (!Array.isArray(raw)) return []
  const out: ProfileShift[] = []
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const s = value as Record<string, unknown>
    if (s.axis !== 'zone' && s.axis !== 'method') continue
    if (typeof s.key !== 'string') continue
    if (s.axis === 'zone' && !isZone(s.key)) continue
    if (s.axis === 'method' && !isMethod(s.key)) continue
    if (s.level !== -1 && s.level !== 1 && s.level !== 2) continue
    if (typeof s.until !== 'string') continue
    const until = Date.parse(s.until)
    if (Number.isNaN(until) || until <= now) continue
    const maxUntil = now + PROFILE_SHIFT_MAX_DAYS * 86_400_000
    if (until > maxUntil) continue
    const source: ProfileShift['source'] =
      s.source === 'user' || s.source === 'llm'
        ? s.source
        : typeof s.changesetId === 'string'
          ? 'llm'
          : 'user'
    // LLM shifts historically required changesetId; keep that rule.
    if (source === 'llm' && typeof s.changesetId !== 'string') continue
    out.push({
      axis: s.axis,
      key: s.key,
      level: s.level,
      until: s.until,
      source,
      ...(typeof s.changesetId === 'string' ? { changesetId: s.changesetId } : {})
    })
  }
  return out
}

/** Base focus + active profile shifts, clamped to [-1, 2]. */
export function effectiveFocus(base: FocusV2, shifts: readonly ProfileShift[]): FocusV2 {
  const next: FocusV2 = {
    zones: { ...base.zones },
    methods: { ...base.methods }
  }
  for (const shift of shifts) {
    if (shift.axis === 'zone' && isZone(shift.key)) {
      next.zones[shift.key as Zone] = clampLevel(shift.level)
    }
    if (shift.axis === 'method' && isMethod(shift.key)) {
      next.methods[shift.key as Method] = clampLevel(shift.level)
    }
  }
  return next
}

function clampLevel(level: number): FocusLevel {
  if (level <= -1) return -1
  if (level >= 2) return 2
  if (level >= 1) return 1
  return 0
}

export function cycleFocusLevel(current: FocusLevel): FocusLevel {
  if (current === 0) return 1
  if (current === 1) return 2
  if (current === 2) return -1
  return 0
}
