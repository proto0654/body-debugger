import { describe, expect, it } from 'vitest'
import { CHARACTER_PACKS, normalizeCharacterPackId } from '@shared/constants/character-packs'
import { characterBodyCandidates, characterFaceCandidates } from '@shared/domain/character-visual'
import { resolveFrameUrl } from '@/components/character/frames'
import { normalizeSettings } from '../../electron/main/persistence/defaults'

describe('character identity resolution', () => {
  it('normalizes unknown identities at the persistence boundary', () => {
    expect(normalizeCharacterPackId('removed')).toBe('desk-hulk')
    expect(normalizeSettings({ characterPackId: 'engineer' }).characterPackId).toBe('engineer')
    expect(normalizeSettings({ characterPackId: '../engineer' }).characterPackId).toBe('desk-hulk')
  })
  it.each(['lean', 'average', 'stocky'] as const)('resolves every delivered identity and state for %s', build => {
    expect(CHARACTER_PACKS).toHaveLength(10)
    for (const pack of CHARACTER_PACKS) {
      const bodies = new Set<string>()
      for (const stage of [0, 1, 2, 3, 4, 5] as const) {
        const url = resolveFrameUrl(characterBodyCandidates(stage, 'neutral', build, 0, pack.id), pack.id)
        expect(url).toContain(`/${pack.id}/frames/`)
        bodies.add(url!)
      }
      expect(bodies.size).toBe(pack.id === 'desk-hulk' ? 3 : 6)
      for (const branch of ['power', 'mobility'] as const) {
        expect(resolveFrameUrl(characterBodyCandidates(5, branch, build, 0, pack.id), pack.id)).toContain(`/${pack.id}/frames/pose-${branch}-${build}.png`)
      }
      for (const level of [1, 2, 3] as const) {
        expect(resolveFrameUrl(characterBodyCandidates(5, 'power', build, level, pack.id), pack.id)).toContain(`neglect-${level}-${build}.png`)
      }
      for (const emotion of ['neutral', 'focused', 'happy', 'proud', 'tired', 'surprised'] as const) {
        expect(resolveFrameUrl(characterFaceCandidates(emotion, build), pack.id)).toContain(`/${pack.id}/frames/emotion-`)
      }
    }
  })
  it('falls back within the chosen identity and never searches another pack', () => {
    expect(resolveFrameUrl(['missing-lean', 'emotion-neutral-average', 'emoji'], 'engineer')).toContain('/engineer/frames/emotion-neutral-average.png')
    expect(resolveFrameUrl(['missing-lean', 'emoji'], 'engineer')).toBeUndefined()
    expect(characterFaceCandidates('happy', 'lean')).toEqual([
      'emotion-happy-lean', 'emotion-happy-average', 'emotion-neutral-lean', 'emotion-neutral-average', 'emoji'
    ])
  })
})
