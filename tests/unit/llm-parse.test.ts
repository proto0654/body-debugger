// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import {
  extractJson,
  flagDuplicates,
  jaccardTokens,
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
})

describe('llm-parse duplicates', () => {
  it('flags similar add ops against the catalog', () => {
    const base = upgradeExercise(EXERCISE_CATALOG[0]!)
    const { id: _id, source: _source, status: _status, ...body } = base
    const records = parseGenerateExercises(JSON.stringify({ exercises: [body] }))
    const flagged = flagDuplicates(records, [base])
    expect(flagged[0]?.issues.some((issue) => issue.includes('duplicate'))).toBe(true)
  })

  it('scores token overlap with jaccardTokens', () => {
    expect(jaccardTokens('a b c', 'b c d')).toBeCloseTo(0.5, 1)
  })
})
