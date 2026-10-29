// @vitest-environment node
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CHARACTER_EMOJI_FRAME,
  CHARACTER_EMOTION_FRAME,
  CHARACTER_STAGE_FRAME,
  characterBodyCandidates,
  characterFaceCandidates,
  frameBuild
} from '@shared/domain/character-visual'
import type { CharacterBranch, CharacterEmotion, CharacterStage } from '@shared/types/character'

const FRAMES_DIR = join(process.cwd(), 'src/assets/character/desk-hulk/frames')
const frameFiles = new Set(readdirSync(FRAMES_DIR).map((file) => file.replace(/\.png$/, '')))

const stages: CharacterStage[] = [0, 1, 2, 3, 4, 5]
const branches: CharacterBranch[] = ['neutral', 'posture', 'power', 'mobility']
const emotions: CharacterEmotion[] = [
  'neutral',
  'focused',
  'happy',
  'proud',
  'tired',
  'surprised'
]

describe('character frame rules', () => {
  it('maps six stages onto three drawn bodies', () => {
    expect(stages.map((stage) => CHARACTER_STAGE_FRAME[stage])).toEqual([0, 0, 2, 2, 4, 4])
  })

  it('maps an unset build to average and keeps lean / stocky', () => {
    expect(frameBuild('neutral')).toBe('average')
    expect(frameBuild('lean')).toBe('lean')
    expect(frameBuild('stocky')).toBe('stocky')
    expect(frameBuild('average')).toBe('average')
  })

  it('maps surprised to the happy bust', () => {
    expect(CHARACTER_EMOTION_FRAME.surprised).toBe('happy')
    expect(CHARACTER_EMOTION_FRAME.neutral).toBe('neutral')
  })
})

describe('characterBodyCandidates', () => {
  it('uses the branch pose for power and mobility from stage 4', () => {
    expect(characterBodyCandidates(4, 'power', 'lean')).toEqual([
      'pose-power-lean',
      'pose-power-average',
      'stage-4-lean',
      'stage-4-average',
      CHARACTER_EMOJI_FRAME
    ])
    expect(characterBodyCandidates(5, 'mobility', 'average')).toEqual([
      'pose-mobility-average',
      'stage-4-average',
      CHARACTER_EMOJI_FRAME
    ])
  })

  it('keeps the stage body below stage 4', () => {
    expect(characterBodyCandidates(3, 'power', 'stocky')).toEqual([
      'stage-2-stocky',
      'stage-2-average',
      CHARACTER_EMOJI_FRAME
    ])
  })

  it('never uses a pose for posture or neutral branches', () => {
    expect(characterBodyCandidates(5, 'posture', 'average')).toEqual([
      'stage-4-average',
      CHARACTER_EMOJI_FRAME
    ])
    expect(characterBodyCandidates(5, 'neutral', 'average')).toEqual([
      'stage-4-average',
      CHARACTER_EMOJI_FRAME
    ])
  })

  it('never repeats a key', () => {
    for (const stage of stages) {
      for (const branch of branches) {
        for (const build of ['lean', 'average', 'stocky', 'neutral'] as const) {
          const candidates = characterBodyCandidates(stage, branch, build)
          expect(new Set(candidates).size).toBe(candidates.length)
        }
      }
    }
  })
})

describe('characterFaceCandidates', () => {
  it('prefers the exact build and falls back to average', () => {
    expect(characterFaceCandidates('proud', 'stocky')).toEqual([
      'emotion-proud-stocky',
      'emotion-proud-average',
      CHARACTER_EMOJI_FRAME
    ])
    expect(characterFaceCandidates('proud', 'neutral')).toEqual([
      'emotion-proud-average',
      CHARACTER_EMOJI_FRAME
    ])
  })
})

describe('frame assets', () => {
  it('ships every body frame the resolver can ask for', () => {
    for (const stage of stages) {
      for (const branch of branches) {
        for (const build of ['lean', 'average', 'stocky', 'neutral'] as const) {
          const frame = characterBodyCandidates(stage, branch, build).find(
            (key) => key !== CHARACTER_EMOJI_FRAME
          )
          expect(frame, `${stage}/${branch}/${build}`).toBeDefined()
          expect(frameFiles.has(frame as string), `${frame}.png`).toBe(true)
        }
      }
    }
  })

  it('ships every emotion frame the resolver can ask for', () => {
    for (const emotion of emotions) {
      for (const build of ['lean', 'average', 'stocky', 'neutral'] as const) {
        const frame = characterFaceCandidates(emotion, build).find(
          (key) => key !== CHARACTER_EMOJI_FRAME
        )
        expect(frame, `${emotion}/${build}`).toBeDefined()
        expect(frameFiles.has(frame as string), `${frame}.png`).toBe(true)
      }
    }
  })
})
