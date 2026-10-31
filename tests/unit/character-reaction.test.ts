// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { characterReaction } from '@shared/domain/character-reaction'
import { reactionDuration, REACTION_TIMING_MS } from '@shared/domain/reaction-timing'

describe('character reactions', () => {
  it('keeps reading time independent of animation or scenario speed', () => {
    expect(reactionDuration('done')).toBe(4500)
    expect(reactionDuration('stage-up')).toBe(6000)
    expect(reactionDuration('streak')).toBe(6000)
    expect(reactionDuration('skipped')).toBe(2500)
    expect(reactionDuration('snoozed')).toBe(2500)
    expect(REACTION_TIMING_MS.exit).toBe(180)
  })
  it('selects comic silhouettes deterministically without losing the emotion contract', () => {
    expect(characterReaction('done', 0).variant).toBe('burst')
    expect(characterReaction('done', 1).variant).toBe('speech')
    expect(characterReaction('stage-up', 0).variant).toBe('ribbon')
    expect(characterReaction('snoozed', 0).variant).toBe('cloud')
    expect(characterReaction('stage-up', 3)).toEqual(characterReaction('stage-up', 3))
  })
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
