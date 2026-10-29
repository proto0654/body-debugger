import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { computeCharacterProgress } from '@shared/domain/character-progress'
import { cloneSettings } from '@shared/domain/settings'
import type { Exercise } from '@shared/types/exercise'
import type { UserProgress } from '@shared/types/progress'
import type { Session, SessionStatus } from '@shared/types/session'
import type { AppSettings } from '@shared/types/settings'

/**
 * Debug scenario presets (docs/TESTING.md). Pure builders: the panel sends the
 * result through a debug-only IPC channel, so nothing here touches persistence.
 */

export type DebugScenarioId =
  | 'steady-week'
  | 'many-skips'
  | 'upper-body'
  | 'frequent-snooze'
  | 'forced-stage-up'
  | 'inventory-emphasis'

export interface DebugScenario {
  id: DebugScenarioId
  title: string
  description: string
}

export const DEBUG_SCENARIOS: readonly DebugScenario[] = [
  {
    id: 'steady-week',
    title: 'Стабильная неделя',
    description: '7 дней подряд по одному выполненному упражнению'
  },
  {
    id: 'many-skips',
    title: 'Много пропусков',
    description: '10 пропусков подряд, персонаж не растёт'
  },
  {
    id: 'upper-body',
    title: 'Только верх',
    description: '12 сессий только на верх тела — ветка posture'
  },
  {
    id: 'frequent-snooze',
    title: 'Частые откладывания',
    description: '6 отложенных и 2 выполненных сессии'
  },
  {
    id: 'forced-stage-up',
    title: 'Новая стадия',
    description: '20 выполненных сессий — стадия 3'
  },
  {
    id: 'inventory-emphasis',
    title: 'Акцент на инвентарь',
    description: 'Инвентарь включён, 10 сессий с оборудованием'
  }
]

export interface DebugScenarioOptions {
  now?: Date
  settings: AppSettings
  progress: UserProgress
}

export interface DebugScenarioResult {
  sessions: Session[]
  settings: AppSettings
  progress: UserProgress
}

function byGroup(group: Exercise['group'], withEquipment = false): Exercise[] {
  return EXERCISE_CATALOG.filter(
    (exercise) =>
      (!group || exercise.group === group) &&
      (withEquipment ? (exercise.equipment?.length ?? 0) > 0 : !exercise.equipment?.length)
  )
}

const UPPER = byGroup('upper')
const MIXED = byGroup(undefined)
const EQUIPMENT = byGroup(undefined, true)

function at(now: Date, daysAgo: number, hour = 9): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 0, 0)
}

function makeSession(
  scenario: DebugScenarioId,
  index: number,
  exercise: Exercise,
  status: SessionStatus,
  now: Date,
  daysAgo: number
): Session {
  const triggered = at(now, daysAgo)
  const completed = new Date(triggered.getTime() + exercise.durationSec * 1000)

  return {
    id: `debug-${scenario}-${index}`,
    exerciseId: exercise.id,
    status,
    durationSec: exercise.durationSec,
    triggeredAt: triggered.toISOString(),
    completedAt: completed.toISOString()
  }
}

function doneSeries(
  scenario: DebugScenarioId,
  exercises: Exercise[],
  count: number,
  now: Date
): Session[] {
  return Array.from({ length: count }, (_, index) =>
    makeSession(scenario, index, exercises[index % exercises.length], 'done', now, count - 1 - index)
  )
}

function withCharacter(
  sessions: Session[],
  base: UserProgress,
  streak: { current: number; max: number }
): UserProgress {
  const character = computeCharacterProgress(sessions)
  return {
    ...base,
    streak: { ...streak },
    characterStage: character.stage,
    characterBranch: character.branch,
    exerciseLevels: { ...base.exerciseLevels },
    focus: {
      primary: base.focus.primary,
      accents: [...base.focus.accents]
    }
  }
}

export function buildDebugScenario(
  id: DebugScenarioId,
  options: DebugScenarioOptions
): DebugScenarioResult {
  const now = options.now ?? new Date()
  const settings = cloneSettings(options.settings)

  switch (id) {
    case 'steady-week': {
      const sessions = doneSeries(id, MIXED, 7, now)
      return {
        sessions,
        settings,
        progress: withCharacter(sessions, options.progress, { current: 7, max: 7 })
      }
    }
    case 'many-skips': {
      const sessions = Array.from({ length: 10 }, (_, index) =>
        makeSession(id, index, MIXED[index % MIXED.length], 'skipped', now, 9 - index)
      )
      return {
        sessions,
        settings,
        progress: withCharacter(sessions, options.progress, { current: 0, max: 0 })
      }
    }
    case 'upper-body': {
      const sessions = doneSeries(id, UPPER, 12, now)
      return {
        sessions,
        settings,
        progress: withCharacter(sessions, options.progress, { current: 12, max: 12 })
      }
    }
    case 'frequent-snooze': {
      const statuses: SessionStatus[] = [
        'snoozed',
        'snoozed',
        'snoozed',
        'snoozed',
        'done',
        'done',
        'snoozed',
        'snoozed'
      ]
      const sessions = statuses.map((status, index) =>
        makeSession(id, index, MIXED[index % MIXED.length], status, now, statuses.length - 1 - index)
      )
      return {
        sessions,
        settings,
        progress: withCharacter(sessions, options.progress, { current: 2, max: 2 })
      }
    }
    case 'forced-stage-up': {
      const sessions = doneSeries(id, MIXED, 20, now)
      return {
        sessions,
        settings,
        progress: withCharacter(sessions, options.progress, { current: 20, max: 20 })
      }
    }
    case 'inventory-emphasis': {
      settings.inventory = {
        enabled: true,
        items: EQUIPMENT_CATALOG.map((item) => item.id)
      }
      const sessions = doneSeries(id, EQUIPMENT, 10, now)
      return {
        sessions,
        settings,
        progress: withCharacter(sessions, options.progress, { current: 10, max: 10 })
      }
    }
    default:
      throw new Error(`Unknown debug scenario: ${String(id)}`)
  }
}


