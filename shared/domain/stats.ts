import { nowDate } from './clock'
import { EXERCISE_CATALOG } from '../constants/exercises'
import type { Exercise, ExerciseGroup } from '../types/exercise'
import type { Session, SessionStatus } from '../types/session'

/**
 * Dashboard calendar + stats (ROADMAP #11). Pure aggregation over stored
 * sessions: no persistence, no Vue, so the numbers are testable on their own.
 */

export const DEFAULT_HEATMAP_DAYS = 91

export type HeatmapLevel = 0 | 1 | 2 | 3

export interface DayActivity {
  /** Local calendar date, YYYY-MM-DD */
  date: string
  done: number
  skipped: number
  snoozed: number
  missed: number
  total: number
  /** 0..3 intensity for the heatmap cell */
  level: HeatmapLevel
}

export interface Heatmap {
  days: DayActivity[]
  /** Monday-first weeks; `null` pads the edges of the grid */
  weeks: (DayActivity | null)[][]
  doneTotal: number
  activeDays: number
}

export interface ZoneSlice {
  category: string
  count: number
  /** Share of all done sessions, 0..1 */
  share: number
}

export interface GroupSlice {
  group: ExerciseGroup
  count: number
}

export interface ExerciseCount {
  exerciseId: string
  title: string
  count: number
}

export interface StatsSummary {
  done: number
  skipped: number
  snoozed: number
  missed: number
  activeDays: number
  /** Done sessions inside the last seven local days */
  weekDone: number
  averagePerActiveDay: number
  zones: ZoneSlice[]
  groups: GroupSlice[]
  topExercises: ExerciseCount[]
}

function sessionTime(session: Session): number | null {
  const parsed = Date.parse(session.completedAt ?? session.triggeredAt)
  return Number.isNaN(parsed) ? null : parsed
}

/** Local calendar key; `toISOString()` would shift the day around midnight. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function emptyDay(date: Date): DayActivity {
  return {
    date: localDateKey(date),
    done: 0,
    skipped: 0,
    snoozed: 0,
    missed: 0,
    total: 0,
    level: 0
  }
}

function countStatus(day: DayActivity, status: SessionStatus): void {
  day.total += 1
  day[status] += 1
}

function toWeeks(days: DayActivity[], windowStart: Date): (DayActivity | null)[][] {
  // Monday-first grid: JS weeks start on Sunday.
  const leading = (windowStart.getDay() + 6) % 7
  const cells: (DayActivity | null)[] = [...Array<null>(leading).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (DayActivity | null)[][] = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

export function buildHeatmap(
  sessions: readonly Session[],
  options: { days?: number; now?: Date } = {}
): Heatmap {
  const requested = options.days ?? DEFAULT_HEATMAP_DAYS
  const days = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : DEFAULT_HEATMAP_DAYS
  const now = options.now ?? nowDate()
  const today = startOfDay(now)
  const windowStart = addDays(today, -(days - 1))

  const dayList: DayActivity[] = []
  const byDate = new Map<string, DayActivity>()
  for (let offset = 0; offset < days; offset += 1) {
    const entry = emptyDay(addDays(windowStart, offset))
    dayList.push(entry)
    byDate.set(entry.date, entry)
  }

  for (const session of sessions) {
    const at = sessionTime(session)
    if (at === null) continue

    const entry = byDate.get(localDateKey(new Date(at)))
    if (entry) countStatus(entry, session.status)
  }

  let doneTotal = 0
  let activeDays = 0
  for (const entry of dayList) {
    entry.level = Math.min(3, entry.done) as HeatmapLevel
    doneTotal += entry.done
    if (entry.done > 0) activeDays += 1
  }

  return {
    days: dayList,
    weeks: toWeeks(dayList, windowStart),
    doneTotal,
    activeDays
  }
}

export function summarizeStats(
  sessions: readonly Session[],
  options: { catalog?: readonly Exercise[]; now?: Date } = {}
): StatsSummary {
  const now = options.now ?? nowDate()
  const catalog = options.catalog ?? EXERCISE_CATALOG
  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]))

  const statusCounts: Record<SessionStatus, number> = {
    done: 0,
    skipped: 0,
    snoozed: 0,
    missed: 0
  }
  const activeDates = new Set<string>()
  const zoneCounts = new Map<string, number>()
  const groupCounts = new Map<ExerciseGroup, number>()
  const exerciseCounts = new Map<string, number>()
  const weekStart = addDays(startOfDay(now), -6).getTime()
  let weekDone = 0

  for (const session of sessions) {
    statusCounts[session.status] += 1
    if (session.status !== 'done') continue

    const at = sessionTime(session)
    if (at !== null) {
      activeDates.add(localDateKey(new Date(at)))
      if (at >= weekStart) weekDone += 1
    }

    const exercise = catalogById.get(session.exerciseId)
    if (exercise) {
      zoneCounts.set(exercise.category, (zoneCounts.get(exercise.category) ?? 0) + 1)
      if (exercise.group) {
        groupCounts.set(exercise.group, (groupCounts.get(exercise.group) ?? 0) + 1)
      }
    }
    exerciseCounts.set(session.exerciseId, (exerciseCounts.get(session.exerciseId) ?? 0) + 1)
  }

  const done = statusCounts.done
  const activeDays = activeDates.size

  const zones: ZoneSlice[] = Array.from(zoneCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      share: done === 0 ? 0 : count / done
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))

  const groups: GroupSlice[] = Array.from(groupCounts.entries())
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group))

  const topExercises: ExerciseCount[] = Array.from(exerciseCounts.entries())
    .map(([exerciseId, count]) => ({
      exerciseId,
      title: catalogById.get(exerciseId)?.title ?? exerciseId,
      count
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, 5)

  return {
    done,
    skipped: statusCounts.skipped,
    snoozed: statusCounts.snoozed,
    missed: statusCounts.missed,
    activeDays,
    weekDone,
    averagePerActiveDay: activeDays === 0 ? 0 : done / activeDays,
    zones,
    groups,
    topExercises
  }
}
