// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import catalog from '../../src/assets/sounds/production.json'
import { CHARACTER_PACKS } from '../../shared/constants/character-packs'

const eventCounts = {
  ready: 4, active: 2, done: 4, 'first-done': 3, 'stage-up': 3, streak: 3,
  welcome: 2, paused: 2, skipped: 3, snoozed: 3, error: 2, alert: 1
}
const reactionAssignments = {
  'approval-01': 'done', 'approval-02': 'done',
  'victory-01': 'done', 'victory-02': 'done', 'chuckle-01': 'done',
  'skeptic-01': 'skipped', 'sigh-01': 'snoozed', 'surprise-01': 'stage-up'
}
const profanity = /(?:бля|жоп|ёб|ебат|еб тво|охуе|охуен|заеб|разъеб|нихуя|сука)/i
const unfinishedPrompt = /\b(?:TODO|TBD|PLACEHOLDER)\b|\{[^}]+\}|<[^>]+>/
const voiceClips = catalog.characters.flatMap(character => character.clips)

describe('manual audio production package', () => {
  it('covers the actual cast with 400 voice positions and nine independent effects', () => {
    expect(catalog.runtimeIntegration).toBe(false)
    expect(catalog.characters.map(character => character.id).sort())
      .toEqual(CHARACTER_PACKS.map(character => character.id).sort())
    expect(catalog.characters).toHaveLength(10)
    expect(voiceClips).toHaveLength(400)
    expect(catalog.effects).toHaveLength(9)
    expect(catalog.policy.silentEvents).toEqual(['missed'])
    expect(catalog.events.map(event => [event.id, event.lineCount]))
      .toEqual(Object.entries(eventCounts))
  })

  it.each(catalog.characters)('provides a complete line and reaction matrix for $id', character => {
    const lines = character.clips.filter(clip => clip.kind === 'line')
    const reactions = character.clips.filter(clip => clip.kind === 'vocal-reaction')
    expect(lines).toHaveLength(32)
    expect(reactions).toHaveLength(8)
    expect(new Set(lines.map(clip => clip.event))).toEqual(new Set(Object.keys(eventCounts)))
    for (const [event, count] of Object.entries(eventCounts)) {
      const variants = lines.filter(clip => clip.event === event)
      expect(variants, `${character.id}/${event}`).toHaveLength(count)
      expect(variants.map(clip => clip.variant))
        .toEqual(Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0')))
      expect(new Set(variants.map(clip => clip.spokenText)).size).toBe(count)
    }
    expect(Object.fromEntries(reactions.map(clip => [clip.variant, clip.event])))
      .toEqual(reactionAssignments)
    expect(character.voiceDesignPrompt).toContain('adult')
    expect(character.voiceDesignPrompt).toContain('native Russian')
    expect(character.voiceDesignPrompt).not.toMatch(/[А-Яа-яЁё\[\]]/)
    expect(character.previewText).toMatch(/[А-Яа-яЁё]/)
    expect(character.previewText.split(/\s+/).length).toBeGreaterThanOrEqual(30)
    expect(character.voiceDesignPrompt).not.toMatch(unfinishedPrompt)
  })

  it('uses unique path-safe IDs and first-take filenames without claiming audio exists', () => {
    const positions = [...voiceClips, ...catalog.effects]
    expect(new Set(positions.map(position => position.id)).size).toBe(409)
    expect(new Set(positions.map(position => position.outputFile)).size).toBe(409)
    for (const position of positions) {
      expect(position.id).toBe(`${position.characterId}__${position.event}__${position.variant}`)
      expect(position.outputFile).toBe(`${position.id}__take-1.mp3`)
      expect(position.outputFile).toMatch(/^[a-z0-9-]+__[a-z0-9-]+__[a-z0-9-]+__take-1\.mp3$/)
    }
    for (const character of catalog.characters) {
      expect(character.clips.every(clip => clip.characterId === character.id)).toBe(true)
    }
  })

  it('keeps ready-to-copy tags, explicit error contexts and profanity annotations accurate', () => {
    for (const character of catalog.characters) {
      const lines = character.clips.filter(clip => clip.kind === 'line')
      const profaneLines = lines.filter(clip => clip.containsProfanity)
      expect(profaneLines.length / lines.length).toBeLessThanOrEqual(0.25)
      for (const clip of character.clips) {
        expect(clip.taggedText).toMatch(/^\[[a-z -]+\]/)
        expect(clip.taggedText).not.toMatch(unfinishedPrompt)
        expect(clip.taggedText.replace(/\[[^\]]+\]/g, '').trim()).toBe(clip.spokenText)
        expect(clip.containsProfanity).toBe(profanity.test(clip.spokenText))
        if (clip.kind === 'line') expect(clip.spokenText).toMatch(/[А-Яа-яЁё]/)
        if ('transcript' in clip) {
          expect(clip.transcript).toMatch(/[А-Яа-яЁё]/)
          expect(clip.performanceDirection).toBeTruthy()
        }
      }
      expect(lines.filter(clip => clip.event === 'error').map(clip => clip.usageContext))
        .toEqual(['failed-session-save', 'failed-operation'])
      expect(lines.find(clip => clip.event === 'error')?.spokenText).toContain('Не сохранилось.')
      expect(lines.find(clip => clip.event === 'alert')?.usageContext).toBe('visible-action-required')
    }
  })

  it('budgets the shortest feedback windows and provides complete effect prompts', () => {
    for (const clip of voiceClips) {
      if (clip.kind === 'vocal-reaction') {
        expect('minDurationSec' in clip && clip.minDurationSec).toBe(0.2)
        expect(clip.maxDurationSec).toBe(0.9)
      } else {
        const limit = ['active', 'paused', 'skipped', 'snoozed'].includes(clip.event) ? 1
          : ['stage-up', 'streak'].includes(clip.event) ? 3.2 : 2.2
        expect(clip.maxDurationSec).toBeGreaterThan(0)
        expect(clip.maxDurationSec).toBeLessThanOrEqual(limit)
      }
    }
    expect(catalog.effects.map(effect => effect.event).sort())
      .toEqual(['alert', 'done', 'error', 'popup', 'skip', 'snooze', 'stage-up', 'start', 'streak'])
    for (const effect of catalog.effects) {
      const limit = ['stage-up', 'streak'].includes(effect.event) ? 1.2 : 0.7
      expect(effect.maxDurationSec).toBe(limit)
      expect(effect.targetDurationSec).toBeGreaterThan(0)
      expect(effect.targetDurationSec).toBeLessThanOrEqual(effect.maxDurationSec)
      expect(effect.prompt).toMatch(/No (?:speech|voice)/)
      expect(effect.prompt).not.toMatch(/[А-Яа-яЁё]/)
      expect(effect.prompt).not.toMatch(unfinishedPrompt)
    }
  })

  it('selects six real pilot cases for each of the three approved characters', () => {
    expect(catalog.pilot.characterIds).toEqual(['desk-hulk', 'alt-girl', 'engineer'])
    expect(catalog.pilot.voiceCandidatesPerCharacter).toBe(3)
    expect(catalog.pilot.takesPerClip).toBe(2)
    expect(new Set(catalog.pilot.clipIds).size).toBe(18)
    for (const characterId of catalog.pilot.characterIds) {
      const clips = catalog.pilot.clipIds.map(id => voiceClips.find(clip => clip.id === id))
        .filter(clip => clip?.characterId === characterId)
      expect(clips).toHaveLength(6)
      expect(clips.map(clip => `${clip?.event}/${clip?.variant}`))
        .toEqual(['ready/01', 'done/01', 'stage-up/01', 'skipped/01', 'error/01', 'done/chuckle-01'])
    }
  })

  it('keeps generated take provenance separate from current scripts and listening approval', () => {
    for (const character of catalog.characters) {
      const identities = new Set(character.selectionHistory.map(selection => selection.voiceId))
      const keys = character.takes.map(take => `${take.clipId}/${take.takeNumber}`)
      expect(new Set(keys).size).toBe(keys.length)
      for (const take of character.takes) {
        const clip = character.clips.find(item => item.id === take.clipId)
        expect(clip).toBeDefined()
        expect(identities.has(take.voiceId)).toBe(true)
        expect(take.model).toBeTruthy()
        expect(take.inputText).toContain(take.clipText)
        expect(take.segmentStartSec).toBeGreaterThanOrEqual(0)
        expect(take.segmentEndSec).toBeGreaterThan(take.segmentStartSec)
        expect(take.measuredDurationSec).toBeGreaterThan(0)
        expect(['pending', 'rejected', 'accepted']).toContain(take.reviewStatus)
        if (take.measuredDurationSec > clip!.maxDurationSec) expect(take.reviewStatus).toBe('rejected')
        for (const path of [take.sourceFile, take.deliveryFile]) {
          expect(path).not.toMatch(/(?:^|\/)\.\.(?:\/|$)|^[A-Za-z]:|\\/)
          expect(path.startsWith(`src/assets/sounds/${character.id}/`)).toBe(true)
          expect(existsSync(join(process.cwd(), path))).toBe(true)
        }
      }
    }
  })
})
