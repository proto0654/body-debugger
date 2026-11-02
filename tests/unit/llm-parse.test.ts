// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { METHOD_LABELS, ZONE_LABELS } from '@shared/constants/catalog-axes'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import {
  extractJson,
  flagDuplicates,
  jaccardTokens,
  normalizeLimitationId,
  normalizeMethodId,
  normalizeZoneId,
  parseGenerateExercises,
  parseOpsPayload
} from '@shared/domain/llm-parse'

describe('llm-parse extractJson', () => {
  it('parses bare JSON and fenced blocks', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('Here you go:\n```json\n{"b":2}\n```')).toEqual({ b: 2 })
  })

  it('throws on empty or invalid payloads', () => {
    expect(() => extractJson('')).toThrow(/empty/)
    expect(() => extractJson('not json at all')).toThrow(/not JSON/)
  })
})

describe('llm-parse generate', () => {
  const draft = upgradeExercise(EXERCISE_CATALOG[0]!)
  const { id: _id, source: _source, status: _status, ...body } = draft

  it('accepts exercises array and ops wrapper', () => {
    const fromArray = parseGenerateExercises(JSON.stringify({ exercises: [body] }))
    expect(fromArray).toHaveLength(1)
    expect(fromArray[0]?.op.op).toBe('add')
    expect(fromArray[0]?.state).toBe('ok')

    const fromOps = parseGenerateExercises(
      JSON.stringify({ ops: [{ op: 'add', exercise: body }] })
    )
    expect(fromOps[0]?.op.op).toBe('add')
  })

  it('rejects invalid exercise drafts', () => {
    const records = parseGenerateExercises(JSON.stringify({ exercises: [{ title: '' }] }))
    expect(records[0]?.state).toBe('rejected')
  })

  it('raises minSec to the method floor instead of rejecting', () => {
    for (const method of ['strength', 'cardio', 'striking'] as const) {
      const records = parseGenerateExercises(
        JSON.stringify({
          exercises: [
            {
              title: `Floor ${method}`,
              description: 'Сделай короткое упражнение, держи спину ровно.',
              method,
              zones: { upper: 1 },
              intensity: 2,
              difficulty: 2,
              timer: { minSec: 25, defaultSec: 35, maxSec: 45 },
              context: { posture: 'standing', quiet: true, noSweat: true },
              emojiFallback: '💪'
            }
          ]
        })
      )
      expect(records[0]?.state, method).not.toBe('rejected')
      if (records[0]?.op.op === 'add') {
        expect(records[0].op.exercise.timer.minSec).toBe(30)
        expect(records[0].op.exercise.timer.defaultSec).toBeGreaterThanOrEqual(30)
        expect(records[0].op.exercise.timer.maxSec).toBeGreaterThanOrEqual(
          records[0].op.exercise.timer.defaultSec
        )
      }
    }
  })

  it('accepts Russian method/zone labels and numeric strings for every axis', () => {
    const cases = [
      { method: 'Ударка', zone: 'Верх', expectMethod: 'striking', expectZone: 'upper' },
      {
        method: 'Растяжки и йога',
        zone: 'Кор и пояс',
        expectMethod: 'mobility',
        expectZone: 'core'
      },
      { method: 'Силовая', zone: 'Низ', expectMethod: 'strength', expectZone: 'lower' },
      {
        method: 'Лёгкая атлетика',
        zone: 'Комплекс',
        expectMethod: 'cardio',
        expectZone: 'full'
      },
      { method: 'Баланс', zone: 'full body', expectMethod: 'balance', expectZone: 'full' },
      {
        method: 'light_athletics',
        zone: 'верх тела',
        expectMethod: 'cardio',
        expectZone: 'upper'
      }
    ] as const

    for (const entry of cases) {
      const records = parseGenerateExercises(
        JSON.stringify({
          exercises: [
            {
              title: `Тест ${entry.expectMethod}`.slice(0, 40),
              description: 'Сделай короткое упражнение, держи спину ровно и колени мягкими.',
              method: entry.method,
              zones: { [entry.zone]: '1' },
              intensity: '2',
              difficulty: '2',
              timer: { minSec: '30', defaultSec: '40', maxSec: '50' },
              context: { posture: 'стоя', quiet: 'true', noSweat: 'да' },
              emojiFallback: '💪',
              avoidIf: ['Поясница', 'knee']
            }
          ]
        })
      )
      expect(records[0]?.state, `${entry.method}/${entry.zone}`).not.toBe('rejected')
      expect(records[0]?.op.op).toBe('add')
      if (records[0]?.op.op === 'add') {
        expect(records[0].op.exercise.method).toBe(entry.expectMethod)
        expect(records[0].op.exercise.zones[entry.expectZone]).toBeCloseTo(1)
        expect(records[0].op.exercise.avoidIf).toEqual(['lower_back', 'knee'])
      }
    }
  })
})

describe('llm-parse enum aliases', () => {
  it('maps every UI method/zone label to its id', () => {
    for (const [id, label] of Object.entries(METHOD_LABELS)) {
      expect(normalizeMethodId(label)).toBe(id)
      expect(normalizeMethodId(id)).toBe(id)
    }
    for (const [id, label] of Object.entries(ZONE_LABELS)) {
      expect(normalizeZoneId(label)).toBe(id)
      expect(normalizeZoneId(id)).toBe(id)
    }
  })

  it('maps limitation labels', () => {
    expect(normalizeLimitationId('Поясница')).toBe('lower_back')
    expect(normalizeLimitationId('knee')).toBe('knee')
    expect(normalizeLimitationId('Запястье')).toBe('wrist')
  })
})

describe('llm-parse ops payload', () => {
  it('parses update and archive ops', () => {
    const target = EXERCISE_CATALOG[0]!
    const records = parseOpsPayload(
      JSON.stringify({
        ops: [
          { op: 'update', id: target.id, patch: { title: 'Новое имя' } },
          { op: 'archive', id: 'user-1', reason: 'obsolete' }
        ]
      })
    )
    expect(records[0]?.op).toEqual({ op: 'update', id: target.id, patch: { title: 'Новое имя' } })
    expect(records[1]?.op.op).toBe('archive')
  })

  it('normalizes method aliases inside update patches', () => {
    const target = EXERCISE_CATALOG[0]!
    const records = parseOpsPayload(
      JSON.stringify({
        ops: [{ op: 'update', id: target.id, patch: { method: 'Ударка' } }]
      })
    )
    expect(records[0]?.state).toBe('ok')
    expect(records[0]?.op).toEqual({ op: 'update', id: target.id, patch: { method: 'striking' } })
  })
})

describe('llm-parse duplicates', () => {
  it('flags similar add ops against the catalog', () => {
    const base = upgradeExercise(EXERCISE_CATALOG[0]!)
    const { id: _id, source: _source, status: _status, ...body } = base
    const records = parseGenerateExercises(JSON.stringify({ exercises: [body] }))
    const flagged = flagDuplicates(records, [base])
    expect(flagged[0]?.issues.some((issue) => issue.includes('duplicate'))).toBe(true)
  })

  it('does not warn coverage-fill variants with distinct titles and cues', () => {
    const base = upgradeExercise(EXERCISE_CATALOG[0]!)
    const method = base.method
    const zone = Object.entries(base.zones).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]![0]
    const existing = {
      ...base,
      id: 'llm-user-main-mock-core-striking-6-1',
      title: `Mock ${zone} ${method} 6.1`,
      description: `Сделай короткое упражнение для ${zone}, держи спину ровно.`
    }
    const draft = {
      title: `Mock ${zone} ${method} 6.2`,
      description: `Вариант 6.2 (${method}/${zone}): сделай короткую серию на месте. не задерживай дыхание.`,
      method,
      zones: { [zone]: 1 },
      intensity: 2,
      difficulty: 2,
      timer: { minSec: 30, defaultSec: 40, maxSec: 50 },
      context: { posture: 'standing' as const, quiet: true, noSweat: true },
      emojiFallback: '💪'
    }
    const records = parseGenerateExercises(JSON.stringify({ exercises: [draft] }))
    const flagged = flagDuplicates(records, [existing])
    expect(flagged[0]?.state).toBe('ok')
    expect(flagged[0]?.issues.some((issue) => issue.includes('duplicate'))).toBe(false)
  })

  it('flags near-copy descriptions inside the same batch', () => {
    const base = upgradeExercise(EXERCISE_CATALOG[0]!)
    const method = base.method
    const zone = Object.entries(base.zones).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]![0]
    const body = {
      title: 'Серия ударов у стола',
      description: 'Стой ровно и сделай короткую серию ударов перед собой, локти мягкие.',
      method,
      zones: { [zone]: 1 },
      intensity: 2,
      difficulty: 2,
      timer: { minSec: 30, defaultSec: 40, maxSec: 50 },
      context: { posture: 'standing' as const, quiet: true, noSweat: true },
      emojiFallback: '💪'
    }
    const twin = {
      ...body,
      title: 'Серия ударов у стола ещё',
      description: 'Стой ровно и сделай короткую серию ударов перед собой, локти мягкие.'
    }
    const records = parseGenerateExercises(JSON.stringify({ exercises: [body, twin] }))
    const flagged = flagDuplicates(records, [])
    expect(flagged[0]?.state).toBe('ok')
    expect(flagged[1]?.state).toBe('warn')
    expect(flagged[1]?.issues.some((issue) => issue.includes('duplicate'))).toBe(true)
  })

  it('scores token overlap with jaccardTokens', () => {
    expect(jaccardTokens('a b c', 'b c d')).toBeCloseTo(0.5, 1)
  })
})
