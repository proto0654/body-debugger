// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DEBUG_SCENARIOS,
  buildDebugScenario,
  type DebugScenarioId
} from '@/debug/scenarios'
import { computeCharacterProgress } from '@shared/domain/character-progress'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { sanitizeSessions } from '@shared/validation/session'
import type { UserProgress } from '@shared/types/progress'
import type { AppSettings } from '@shared/types/settings'
import { makeSettings } from '../fixtures'

const NOW = new Date(2026, 9, 30, 12, 0, 0)

const PROGRESS: UserProgress = {
  streak: { current: 0, max: 0 },
  characterStage: 0,
  characterBranch: 'neutral',
  characterBuild: 'average',
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

function build(id: DebugScenarioId, settings: AppSettings = makeSettings()) {
  return buildDebugScenario(id, { now: NOW, settings, progress: PROGRESS })
}

describe('debug scenarios', () => {
  it('lists the six documented presets', () => {
    expect(DEBUG_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'steady-week',
      'many-skips',
      'upper-body',
      'frequent-snooze',
      'forced-stage-up',
      'inventory-emphasis'
    ])
    for (const scenario of DEBUG_SCENARIOS) {
      expect(scenario.title.trim().length).toBeGreaterThan(0)
      expect(scenario.description.trim().length).toBeGreaterThan(0)
    }
  })

  it.each(DEBUG_SCENARIOS.map((scenario) => scenario.id))(
    'builds a valid, stable payload for "%s"',
    (id) => {
      const first = build(id)
      const second = build(id)

      expect(sanitizeSessions(first.sessions)).toHaveLength(first.sessions.length)
      expect(new Set(first.sessions.map((session) => session.id)).size).toBe(
        first.sessions.length
      )
      expect(first.sessions).toEqual(second.sessions)
      expect(first.progress.characterStage).toBe(
        computeCharacterProgress(first.sessions).stage
      )
      expect(first.progress.characterBranch).toBe(
        computeCharacterProgress(first.sessions).branch
      )
      expect(first.progress.characterBuild).toBe('average')
    }
  )

  it('seeds a steady week of done sessions and a streak', () => {
    const result = build('steady-week')

    expect(result.sessions).toHaveLength(7)
    expect(result.sessions.every((session) => session.status === 'done')).toBe(true)
    expect(new Set(result.sessions.map((session) => session.triggeredAt.slice(0, 10))).size).toBe(7)
    expect(result.progress.streak.current).toBe(7)
    expect(result.progress.streak.max).toBeGreaterThanOrEqual(7)
  })

  it('seeds many skips without advancing the character', () => {
    const result = build('many-skips')

    expect(result.sessions.filter((session) => session.status === 'skipped').length).toBeGreaterThanOrEqual(8)
    expect(result.sessions.some((session) => session.status === 'done')).toBe(false)
    expect(result.progress.characterStage).toBe(0)
  })

  it('keeps the upper-body preset inside the upper group', () => {
    const byId = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise]))
    const result = build('upper-body')

    expect(result.sessions.length).toBeGreaterThan(5)
    for (const session of result.sessions) {
      expect(byId.get(session.exerciseId)?.group).toBe('upper')
    }
  })

  it('seeds frequent snoozes with only a couple of done sessions', () => {
    const result = build('frequent-snooze')

    expect(result.sessions.filter((session) => session.status === 'snoozed').length).toBeGreaterThanOrEqual(5)
    expect(result.sessions.filter((session) => session.status === 'done').length).toBeLessThanOrEqual(2)
  })

  it('forces a stage-up payload', () => {
    const result = build('forced-stage-up')

    expect(result.sessions.filter((session) => session.status === 'done').length).toBe(20)
    expect(result.progress.characterStage).toBe(3)
  })

  it('turns inventory on and owns every equipment item', () => {
    const result = build('inventory-emphasis')
    const withEquipment = result.sessions.filter((session) => {
      const exercise = EXERCISE_CATALOG.find((entry) => entry.id === session.exerciseId)
      return exercise?.equipment?.length
    })

    expect(result.settings.inventory.enabled).toBe(true)
    expect(result.settings.inventory.items).toEqual(
      expect.arrayContaining(['bag-50', 'punching-bag', 'resistance-band', 'dumbbells'])
    )
    expect(withEquipment).toHaveLength(result.sessions.length)
  })

  it('leaves the base settings untouched for scenarios that do not need them', () => {
    const base = makeSettings({ inventory: { enabled: false, items: ['dumbbells'] } })
    const result = build('steady-week', base)

    expect(result.settings).toEqual(base)
    expect(result.settings).not.toBe(base)
    base.inventory.items.push('bag-50')
    expect(result.settings.inventory.items).toEqual(['dumbbells'])
  })

  it('rejects an unknown scenario id', () => {
    expect(() => build('nope' as DebugScenarioId)).toThrow(/unknown debug scenario/i)
  })
})
