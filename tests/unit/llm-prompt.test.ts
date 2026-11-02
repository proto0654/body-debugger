// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import { LLM_MAX_EXERCISES } from '@shared/constants/catalog-tuning'
import {
  LLM_SYSTEM_PROMPT,
  buildEditPayload,
  buildGeneratePayload,
  capGenerateCells,
  estimateTokens
} from '@shared/domain/llm-prompt'

describe('llm-prompt builders', () => {
  const examples = EXERCISE_CATALOG.slice(0, 3).map((entry) => upgradeExercise(entry))

  it('builds a generate payload without inventing ids', () => {
    const payload = buildGeneratePayload({
      cells: [{ zone: 'upper', method: 'strength', count: 2 }],
      equipment: ['band'],
      existingTitles: ['Круги головой'],
      examples
    })
    expect(payload.task).toBe('generate')
    expect(payload.cells).toEqual([{ zone: 'upper', method: 'strength', count: 2 }])
    expect(payload.existingTitles).toContain('Круги головой')
    expect(payload.examples).toHaveLength(3)
    expect(payload.examples.every((example) => !('id' in (example as object)))).toBe(true)
  })

  it('builds edit/retag/tune payloads with instruction and optional aggregates', () => {
    const edit = buildEditPayload({
      kind: 'edit',
      instruction: 'сделай растяжки длиннее',
      catalog: examples
    })
    expect(edit.task).toBe('edit')
    expect(edit.instruction).toBe('сделай растяжки длиннее')

    const tune = buildEditPayload({
      kind: 'tune',
      catalog: examples,
      aggregates: { stage: 1 }
    })
    expect(tune.task).toBe('tune')
    expect(tune.aggregates).toEqual({ stage: 1 })
  })

  it('estimates tokens from system + user messages', () => {
    const tokens = estimateTokens({
      system: LLM_SYSTEM_PROMPT,
      user: JSON.stringify({ task: 'generate', cells: [] })
    })
    expect(tokens).toBeGreaterThan(50)
  })

  it('caps generate demand to LLM_MAX_EXERCISES with fair round-robin', () => {
    const cells = Array.from({ length: 19 }, (_, index) => ({
      zone: (['upper', 'core', 'lower', 'full'] as const)[index % 4]!,
      method: (['mobility', 'strength', 'cardio', 'striking', 'balance'] as const)[index % 5]!,
      count: 6
    }))
    const capped = capGenerateCells(cells)
    const total = capped.reduce((sum, cell) => sum + cell.count, 0)
    expect(total).toBe(LLM_MAX_EXERCISES)
    expect(capped.length).toBeLessThanOrEqual(19)
    expect(capped.every((cell) => cell.count >= 1)).toBe(true)
    expect(capGenerateCells([{ zone: 'upper', method: 'strength', count: 2 }])).toEqual([
      { zone: 'upper', method: 'strength', count: 2 }
    ])
  })
})
