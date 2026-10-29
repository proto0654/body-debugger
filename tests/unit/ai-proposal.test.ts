// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  canApproveExercise,
  mergeCatalogs,
  parseExerciseProposal
} from '@shared/domain/ai-proposal'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import type { Exercise } from '@shared/types/exercise'
import { makeExercise } from '../fixtures'

const proposal: Exercise = {
  id: 'ai-neck-reset',
  title: 'Сброс шеи',
  description: 'Медленные кивки и повороты без боли.',
  durationSec: 40,
  difficulty: 2,
  category: 'neck',
  group: 'upper',
  emojiFallback: '🧘',
  focus: ['mobility']
}

describe('parseExerciseProposal', () => {
  it('accepts a raw JSON object', () => {
    const result = parseExerciseProposal(JSON.stringify(proposal))
    expect(result).toEqual({ exercise: proposal, error: null })
  })

  it('accepts JSON wrapped in a markdown code fence', () => {
    const text = 'Вот упражнение:\n```json\n' + JSON.stringify(proposal) + '\n```\nГотово.'
    expect(parseExerciseProposal(text).exercise).toEqual(proposal)
  })

  it('extracts the object from surrounding prose', () => {
    expect(parseExerciseProposal(`Предлагаю: ${JSON.stringify(proposal)} — попробуй.`).exercise)
      .toEqual(proposal)
  })

  it('rejects empty or non-string input', () => {
    expect(parseExerciseProposal('   ').error).toBe('empty')
    expect(parseExerciseProposal(null).error).toBe('empty')
    expect(parseExerciseProposal(42).error).toBe('empty')
  })

  it('rejects broken JSON', () => {
    expect(parseExerciseProposal('{ "id": ').error).toBe('invalid-json')
  })

  it('rejects an object that is not a valid Exercise', () => {
    expect(parseExerciseProposal('{}').error).toBe('invalid-exercise')
    expect(
      parseExerciseProposal(JSON.stringify({ ...proposal, durationSec: 0 })).error
    ).toBe('invalid-exercise')
    expect(
      parseExerciseProposal(JSON.stringify({ ...proposal, difficulty: 9 })).error
    ).toBe('invalid-exercise')
    expect(parseExerciseProposal(JSON.stringify([proposal])).error).toBe('invalid-exercise')
  })
})

describe('canApproveExercise', () => {
  it('accepts a new id and rejects a duplicate', () => {
    expect(canApproveExercise(proposal, ['neck-tilts'])).toEqual({ ok: true, reason: null })
    expect(canApproveExercise(proposal, ['ai-neck-reset'])).toEqual({
      ok: false,
      reason: 'duplicate-id'
    })
  })

  it('rejects an id that already exists in the shipped catalog', () => {
    const clash = { ...proposal, id: EXERCISE_CATALOG[0].id }
    expect(canApproveExercise(clash, EXERCISE_CATALOG.map((exercise) => exercise.id))).toEqual({
      ok: false,
      reason: 'duplicate-id'
    })
  })
})

describe('mergeCatalogs', () => {
  it('keeps the shipped catalog first and appends approved exercises', () => {
    const merged = mergeCatalogs([makeExercise({ id: 'base' })], [proposal])

    expect(merged.map((exercise) => exercise.id)).toEqual(['base', 'ai-neck-reset'])
  })

  it('never lets a custom exercise override a shipped id', () => {
    const override = makeExercise({ id: 'base', title: 'Hacked' })
    const merged = mergeCatalogs([makeExercise({ id: 'base', title: 'Original' })], [override])

    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('Original')
  })

  it('deduplicates repeated custom ids', () => {
    const merged = mergeCatalogs([], [proposal, { ...proposal, title: 'Duplicate' }])
    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe(proposal.title)
  })
})
