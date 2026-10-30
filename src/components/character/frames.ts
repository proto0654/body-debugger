import { CHARACTER_EMOJI_FRAME } from '@shared/domain/character-visual'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'
import { normalizeCharacterPackId } from '@shared/constants/character-packs'

/**
 * Sprite frames are bundled from `src/assets/character/desk-hulk/frames/`.
 * Keys follow the naming in `scripts/cut-character-sprites.py`:
 * `stage-{stage}-{build}`, `pose-{branch}-{build}`, `emotion-{emotion}-{build}`,
 * `neglect-{level}-{build}`.
 */
const frameModules = import.meta.glob<string>(
  '../../assets/character/*/frames/*.png',
  { eager: true, import: 'default' }
)

const frameUrls = new Map(
  Object.entries(frameModules).map(([path, url]) => [
    `${path.split('/').at(-3)}/${path.slice(path.lastIndexOf('/') + 1, -'.png'.length)}`,
    url
  ])
)

/** First candidate that exists on disk; `undefined` means "use the emoji". */
export function resolveFrameUrl(candidates: string[], packId = DEFAULT_CHARACTER_PACK): string | undefined {
  const identity = normalizeCharacterPackId(packId)
  for (const key of candidates) {
    if (key === CHARACTER_EMOJI_FRAME) break
    const url = frameUrls.get(`${identity}/${key}`)
    if (url) return url
  }
  return undefined
}
