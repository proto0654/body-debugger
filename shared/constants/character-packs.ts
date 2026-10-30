import manifest from '../../src/assets/character/packs.json'
import { DEFAULT_CHARACTER_PACK } from './character'

/** The artwork manifest owns the supplied cast; Desk Hulk is the built-in default. */
export const CHARACTER_PACKS = [
  { id: DEFAULT_CHARACTER_PACK, label: 'Desk Hulk' },
  ...manifest.packs.map(({ id, label }) => ({ id, label }))
] as const

export function normalizeCharacterPackId(value: unknown): string {
  return typeof value === 'string' && CHARACTER_PACKS.some(pack => pack.id === value)
    ? value : DEFAULT_CHARACTER_PACK
}
