import { CHARACTER_PACKS } from '@shared/constants/character-packs'
import { VOICE_EVENTS, isVoiceEvent, type VoiceEvent } from '@shared/domain/sounds'

/**
 * Runtime manifest of the generated audio package (docs/AUDIO-PRODUCTION.md).
 *
 * The files are imported as URLs, so Vite emits one asset per clip and the
 * renderer only holds strings. Nothing here is shipped behaviour by itself: the
 * player decides whether a clip is audible.
 */
export interface VoiceClip {
  characterId: string
  event: VoiceEvent
  variant: string
  url: string
}

/** One shared effect take; `take` keeps the archived retakes addressable. */
export interface EffectClip {
  id: string
  event: string
  variant: string
  take: number
  url: string
}

const PACK_IDS = new Set<string>(CHARACTER_PACKS.map((pack) => pack.id))
const VOICE_FILE = /^([a-z0-9-]+)__([a-z0-9-]+)__([a-z0-9-]+)__take-1\.mp3$/
const EFFECT_FILE = /^system__([a-z0-9-]+)__([a-z0-9-]+)__take-(\d+)\.mp3$/

/**
 * `characters`, `system` and a file that does not parse are ignored: the catalog
 * is the source of truth and only known characters may speak.
 */
export function buildVoiceCatalog(files: Record<string, string>): VoiceClip[] {
  const clips: VoiceClip[] = []
  for (const [path, url] of Object.entries(files)) {
    const name = path.split(/[\\/]/).pop() ?? ''
    const match = VOICE_FILE.exec(name)
    if (!match) continue
    const [, characterId, event, variant] = match
    if (!PACK_IDS.has(characterId!) || !isVoiceEvent(event)) continue
    clips.push({ characterId, event, variant: variant!, url })
  }
  return clips.sort((a, b) => a.characterId.localeCompare(b.characterId)
    || a.event.localeCompare(b.event)
    || a.variant.localeCompare(b.variant))
}

export function buildEffectCatalog(files: Record<string, string>): EffectClip[] {
  const clips: EffectClip[] = []
  for (const [path, url] of Object.entries(files)) {
    const name = path.split(/[\\/]/).pop() ?? ''
    const match = EFFECT_FILE.exec(name)
    if (!match) continue
    clips.push({ id: `system__${match[1]}__${match[2]}`, event: match[1]!, variant: match[2]!, take: Number(match[3]), url })
  }
  return clips.sort((a, b) => a.event.localeCompare(b.event) || a.take - b.take)
}

const VOICE_FILES = import.meta.glob('./assets/sounds/*/*__take-1.mp3', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const EFFECT_FILES = import.meta.glob('./assets/sounds/system/*__take-*.mp3', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

export const VOICE_CLIPS: readonly VoiceClip[] = buildVoiceCatalog(VOICE_FILES)
export const EFFECT_CLIPS: readonly EffectClip[] = buildEffectCatalog(EFFECT_FILES)

const BY_CHARACTER_EVENT = new Map<string, VoiceClip[]>()
for (const clip of VOICE_CLIPS) {
  const key = `${clip.characterId}#${clip.event}`
  const bucket = BY_CHARACTER_EVENT.get(key)
  if (bucket) bucket.push(clip)
  else BY_CHARACTER_EVENT.set(key, [clip])
}

/** Variants of one spoken event, or an empty list when the voice has no take. */
export function voiceClips(characterId: string, event: VoiceEvent): readonly VoiceClip[] {
  return BY_CHARACTER_EVENT.get(`${characterId}#${event}`) ?? []
}
