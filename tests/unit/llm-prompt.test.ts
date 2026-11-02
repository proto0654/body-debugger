// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import {
  LLM_SYSTEM_PROMPT,
  buildEditPayload,
  buildGeneratePayload,
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
})
