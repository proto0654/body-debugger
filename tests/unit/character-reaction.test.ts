// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { characterReaction } from '@shared/domain/character-reaction'

describe('character reactions', () => {
  it('varies a recurring event across session histories and avoids an immediate repeat', () => {
    const first = characterReaction('done', 0)
    expect(characterReaction('done', 1).caption).not.toBe(first.caption)
    expect(characterReaction('done', 0, first.caption).caption).not.toBe(first.caption)
    expect(characterReaction('done', Number.NaN)).toEqual(first)
  })

  it('reserves strong reactions for success and milestones', () => {
    expect(characterReaction('active')).toMatchObject({ emotion: 'focused', tone: 'calm' })
    expect(characterReaction('done')).toMatchObject({ emotion: 'happy', tone: 'cheer' })
    expect(characterReaction('stage-up')).toMatchObject({ emotion: 'surprised', tone: 'milestone' })
    expect(characterReaction('streak')).toMatchObject({ emotion: 'proud', tone: 'milestone' })
  })

  it.each(['skipped', 'snoozed', 'paused'] as const)('keeps %s neutral and calm', event => {
    expect(characterReaction(event)).toMatchObject({ emotion: 'neutral', tone: 'calm' })
  })
})
