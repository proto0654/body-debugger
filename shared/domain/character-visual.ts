import type {
  CharacterBranch,
  CharacterBuild,
  CharacterEmotion,
  CharacterStage
} from '../types/character'

/**
 * Pure rules for turning the abstract character state into sprite frame keys.
 * The frames themselves are cut from the source sheets by
 * `scripts/cut-character-sprites.py`; see docs/ARCHITECTURE.md.
 */

/** Six stages are drawn as three bodies: start/awake, moving/steady, strong/peak. */
export const CHARACTER_STAGE_FRAME: Record<CharacterStage, 0 | 2 | 4> = {
  0: 0,
  1: 0,
  2: 2,
  3: 2,
  4: 4,
  5: 4
}

/** Art has three builds; an unset build falls back to the average body. */
export const CHARACTER_FRAME_BUILDS = ['lean', 'average', 'stocky'] as const

export type CharacterFrameBuild = (typeof CHARACTER_FRAME_BUILDS)[number]

/** There is no surprised bust yet; the happy one is the closest match. */
export const CHARACTER_EMOTION_FRAME: Record<CharacterEmotion, CharacterEmotion> = {
  neutral: 'neutral',
  focused: 'focused',
  happy: 'happy',
  proud: 'proud',
  tired: 'tired',
  surprised: 'happy'
}

/** Last resort when no sprite exists for the pack. */
export const CHARACTER_EMOJI_FRAME = 'emoji'

export function frameBuild(build: CharacterBuild): CharacterFrameBuild {
  return build === 'lean' || build === 'stocky' ? build : 'average'
}

function withBuildFallback(prefix: string, build: CharacterFrameBuild): string[] {
  if (build === 'average') return [`${prefix}-average`]
  return [`${prefix}-${build}`, `${prefix}-average`]
}

/**
 * Body frames, most specific first. The source art draws the branch pose only
 * as the strong/peak form, so `power` / `mobility` switch to it from stage 4;
 * below that the stage body wins. Then the average build, then the emoji.
 */
export function characterBodyCandidates(
  stage: CharacterStage,
  branch: CharacterBranch,
  build: CharacterBuild
): string[] {
  const buildKey = frameBuild(build)
  const stageFrame = CHARACTER_STAGE_FRAME[stage]
  const hasBranchPose = stageFrame >= 4 && (branch === 'power' || branch === 'mobility')
  const pose = hasBranchPose ? withBuildFallback(`pose-${branch}`, buildKey) : []
  const body = withBuildFallback(`stage-${stageFrame}`, buildKey)
  const keys = [...pose, ...body, CHARACTER_EMOJI_FRAME]
  return keys.filter((key, index) => keys.indexOf(key) === index)
}

/** Emotion busts for the popup face, same build-fallback rule. */
export function characterFaceCandidates(
  emotion: CharacterEmotion,
  build: CharacterBuild
): string[] {
  const emotionKey = CHARACTER_EMOTION_FRAME[emotion]
  return [...withBuildFallback(`emotion-${emotionKey}`, frameBuild(build)), CHARACTER_EMOJI_FRAME]
}
