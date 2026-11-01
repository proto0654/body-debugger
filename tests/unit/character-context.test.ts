import { describe, expect, it } from 'vitest'
import { defaultManualState, type CharacterContext } from '@shared/domain/character-context'
import { makeSession } from '../fixtures'

const NOW = new Date(2026, 9, 31, 12, 0, 0)

function context(overrides: Partial<CharacterContext> = {}): CharacterContext {
  return {
    id: 'main',
    title: 'Main',
    sessions: [],
    packId: 'desk-hulk',
    build: 'average',
    allowStart: false,
    manual: null,
    ...overrides
  }
}

describe('character context', () => {
  it('starts a manual preview at the end of the provided history', () => {
    const state = defaultManualState(context({ sessions: [
      makeSession({ exerciseId: 'neck-tilts', completedAt: new Date(2026, 9, 29, 12).toISOString() }),
      makeSession({ exerciseId: 'neck-tilts', completedAt: new Date(2026, 9, 30, 12).toISOString() }),
      makeSession({ exerciseId: 'neck-tilts', completedAt: new Date(2026, 9, 31, 12).toISOString() })
    ] }), NOW)
    expect(state.stage).toBe(1)
    expect(state.branch).not.toBe('neutral')
    expect(state.condition).toBe(0)
    expect(state.build).toBe('average')
    expect(state.emotion).toBe('neutral')
  })

  it('uses a concrete build when the context has no chosen build', () => {
    expect(defaultManualState(context({ build: 'neutral' }), NOW).build).toBe('average')
  })
})
