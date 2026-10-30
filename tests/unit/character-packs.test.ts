// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '../../src/assets/character/packs.json'

const root = join(process.cwd(), 'src/assets/character')
const builds = Object.values(manifest.sheets).flat()

describe('generated character packs', () => {
  it('lists nine unique identities, three real builds and sixteen distinct states', () => {
    expect(manifest.packs).toHaveLength(9)
    expect(new Set(manifest.packs.map(pack => pack.id)).size).toBe(9)
    expect(builds).toEqual(['average', 'lean', 'stocky'])
    expect(new Set(manifest.frames).size).toBe(16)
    expect(manifest.frames.filter(frame => frame.startsWith('stage-'))).toHaveLength(6)
    expect(manifest.frames.filter(frame => frame.startsWith('neglect-'))).toHaveLength(3)
    expect(manifest.frames.filter(frame => frame.startsWith('emotion-'))).toHaveLength(5)
    expect(manifest.frames.filter(frame => frame.startsWith('pose-'))).toHaveLength(2)
  })

  it.each(manifest.packs)('ships all 48 RGBA frames and reproducible sources for $id', (pack) => {
    const directory = join(root, pack.id)
    expect(readdirSync(join(directory, 'frames')).filter(file => file.endsWith('.png'))).toHaveLength(48)
    for (const sheet of Object.keys(pack.sheets ?? manifest.sheets)) {
      expect(readFileSync(join(directory, sheet)).length).toBeGreaterThan(10_000)
      expect(readFileSync(join(directory, sheet.replace('.png', '.prompt.txt')), 'utf8')).toContain('image_gen')
    }
    for (const source of Object.values(pack.overrides ?? {})) {
      expect(readFileSync(join(directory, source)).length).toBeGreaterThan(10_000)
      expect(readFileSync(join(directory, source.replace('.png', '.prompt.txt')), 'utf8')).toContain('image_gen')
    }
    for (const state of manifest.frames) {
      const images = builds.map(build => readFileSync(join(directory, 'frames', `${state}-${build}.png`)))
      for (const png of images) {
        expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        expect(png.readUInt32BE(16)).toBeGreaterThan(32)
        expect(png.readUInt32BE(20)).toBeGreaterThan(32)
        expect(png[25]).toBe(6) // True-colour PNG with alpha.
      }
      // Separate builds must contain different artwork, not aliases of one file.
      expect(images[0].equals(images[1])).toBe(false)
      expect(images[1].equals(images[2])).toBe(false)
      expect(images[0].equals(images[2])).toBe(false)
    }
  })
})
