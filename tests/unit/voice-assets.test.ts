// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CHARACTER_PACKS } from '@shared/constants/character-packs'
import { VOICE_EVENTS } from '@shared/domain/sounds'
import { EFFECT_CLIPS, VOICE_CLIPS, buildEffectCatalog, buildVoiceCatalog, voiceClips } from '@/voice-assets'

const packIds = CHARACTER_PACKS.map((pack) => pack.id)

describe('voice asset manifest', () => {
  it('parses generated take-1 files into character/event/variant entries', () => {
    const clips = buildVoiceCatalog({
      '/x/desk-hulk/desk-hulk__done__02__take-1.mp3': 'a.mp3',
      '/x/punk/punk__stage-up__surprise-01__take-1.mp3': 'b.mp3'
    })

    expect(clips).toEqual([
      { characterId: 'desk-hulk', event: 'done', variant: '02', url: 'a.mp3' },
      { characterId: 'punk', event: 'stage-up', variant: 'surprise-01', url: 'b.mp3' }
    ])
  })

  it('ignores shared effects, retakes and unknown characters', () => {
    const clips = buildVoiceCatalog({
      '/x/system/system__popup__01__take-1.mp3': 'e.mp3',
      '/x/system/system__skip__01__take-2.mp3': 'f.mp3',
      '/x/desk-hulk/desk-hulk__done__01__take-2.mp3': 'g.mp3',
      '/x/unknown/unknown__done__01__take-1.mp3': 'h.mp3',
      '/x/desk-hulk/desk-hulk__nope__01__take-1.mp3': 'i.mp3',
      '/x/default/done.mp3': 'j.mp3'
    })

    expect(clips).toEqual([])
  })

  it('covers the produced package for every cast character', () => {
    for (const id of packIds) {
      expect(VOICE_CLIPS.some((clip) => clip.characterId === id), id).toBe(true)
      for (const event of VOICE_EVENTS) {
        const clips = voiceClips(id, event)
        expect(clips.length, `${id}/${event}`).toBeGreaterThan(0)
      }
    }
    expect(VOICE_CLIPS).toHaveLength(400)
  })

  it('keeps every variant of an event and no duplicates', () => {
    const keys = VOICE_CLIPS.map((clip) => `${clip.characterId}/${clip.event}/${clip.variant}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(voiceClips('desk-hulk', 'done').map((clip) => clip.variant))
      .toEqual(['01', '02', '03', '04', 'approval-01', 'approval-02', 'chuckle-01', 'victory-01', 'victory-02'])
  })

  it('lists the nine shared effects with their archived takes', () => {
    expect(buildEffectCatalog({
      '/x/system/system__skip__01__take-1.mp3': 's.mp3',
      '/x/system/system__start__01__take-2.mp3': 't.mp3'
    })).toEqual([
      { id: 'system__skip__01', event: 'skip', variant: '01', take: 1, url: 's.mp3' },
      { id: 'system__start__01', event: 'start', variant: '01', take: 2, url: 't.mp3' }
    ])
    expect(new Set(EFFECT_CLIPS.map((clip) => clip.event)).size).toBe(9)
  })
})
