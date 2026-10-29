import { CHARACTER_EMOJI_FRAME } from '@shared/domain/character-visual'

/**
 * Sprite frames are bundled from `src/assets/character/desk-hulk/frames/`.
 * Keys follow the naming in `scripts/cut-character-sprites.py`:
 * `stage-{stage}-{build}`, `pose-{branch}-{build}`, `emotion-{emotion}-{build}`.
 */
const frameModules = import.meta.glob<string>(
  '../../assets/character/desk-hulk/frames/*.png',
  { eager: true, import: 'default' }
)

const frameUrls = new Map(
  Object.entries(frameModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.png'.length),
    url
  ])
)

/** First candidate that exists on disk; `undefined` means "use the emoji". */
export function resolveFrameUrl(candidates: string[]): string | undefined {
  for (const key of candidates) {
    if (key === CHARACTER_EMOJI_FRAME) break
    const url = frameUrls.get(key)
    if (url) return url
  }
  return undefined
}
