// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateLabVisualPreview, type LabVisualPreview } from '@shared/domain/laboratory-preview'

const preview: LabVisualPreview = { packId: 'engineer', stage: 5, build: 'stocky', branch: 'power', condition: 3,
  emotion: 'happy', popup: 'done', sequence: 2 }

describe('manual laboratory preview boundary', () => {
  it('copies validated visual overrides and strips unrelated payload fields', () => {
    const result = validateLabVisualPreview({ ...preview, sessions: ['untrusted'] })
    expect(result).toEqual(preview)
    expect(result).not.toBe(preview)
    expect(result).not.toHaveProperty('sessions')
  })
  it.each([
    { packId: '../missing' }, { stage: 6 }, { stage: '5' }, { stage: 1.5 }, { condition: 4 }, { condition: -1 },
    { emotion: ['happy'] }, { emotion: 'missing' }, { branch: 'admin' }, { build: 'unknown' },
    { popup: 'execute' }, { sequence: -1 }, { sequence: Number.NaN }, { sequence: 1.5 }
  ])('rejects an invalid override: %j', patch => {
    expect(() => validateLabVisualPreview({ ...preview, ...patch })).toThrow('Invalid visual preview')
  })
})
