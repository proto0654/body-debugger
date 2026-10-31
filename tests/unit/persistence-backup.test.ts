// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { backupDataOnVersionChange } from '../../electron/main/persistence/version-backup'

let root = ''
let dataDir = ''
let backupRoot = ''

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bd-backup-'))
  dataDir = join(root, 'data')
  backupRoot = join(root, 'data-backup')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, 'settings.json'), '{"version":1}')
  writeFileSync(join(dataDir, 'sessions.json'), '{"version":1}')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('data backup on a version change', () => {
  it('only records the version on a first run', () => {
    expect(backupDataOnVersionChange(dataDir, '0.2.0')).toBeNull()
    expect(existsSync(backupRoot)).toBe(false)
    expect(readFileSync(join(dataDir, 'app-version.txt'), 'utf8')).toBe('0.2.0')
  })

  it('does nothing when the version did not change', () => {
    backupDataOnVersionChange(dataDir, '0.2.0')
    expect(backupDataOnVersionChange(dataDir, '0.2.0')).toBeNull()
    expect(existsSync(backupRoot)).toBe(false)
  })

  it('copies the stored JSON before a new version reads it', () => {
    backupDataOnVersionChange(dataDir, '0.2.0')

    const backupPath = backupDataOnVersionChange(dataDir, '0.2.1')

    expect(backupPath).toBe(join(backupRoot, '0.2.0'))
    expect(readdirSync(backupPath!).sort()).toEqual(['sessions.json', 'settings.json'])
    // The backup holds the state from before the restart, not later writes.
    expect(readFileSync(join(backupPath!, 'settings.json'), 'utf8')).toBe('{"version":1}')
    expect(readFileSync(join(dataDir, 'app-version.txt'), 'utf8')).toBe('0.2.1')
  })

  it('keeps the existing backup when the same transition happens twice', () => {
    backupDataOnVersionChange(dataDir, '0.2.0')
    writeFileSync(join(dataDir, 'settings.json'), '{"first":true}')
    backupDataOnVersionChange(dataDir, '0.2.1')

    writeFileSync(join(dataDir, 'app-version.txt'), '0.2.0')
    writeFileSync(join(dataDir, 'settings.json'), '{"second":true}')
    backupDataOnVersionChange(dataDir, '0.2.1')

    expect(readFileSync(join(backupRoot, '0.2.0', 'settings.json'), 'utf8')).toBe('{"first":true}')
  })

  it('keeps only the two most recent backups', () => {
    const versions = ['0.1.0', '0.2.0', '0.2.1']
    for (let index = 0; index < versions.length; index += 1) {
      const version = versions[index]
      backupDataOnVersionChange(dataDir, version)
      const directory = join(backupRoot, version)
      const time = new Date(Date.UTC(2026, 0, index + 1))
      if (existsSync(directory)) utimesSync(directory, time, time)
      writeFileSync(join(dataDir, 'app-version.txt'), version)
    }

    // A fourth version change prunes below two kept backups.
    backupDataOnVersionChange(dataDir, '0.3.0')

    const kept = readdirSync(backupRoot).sort()
    expect(kept).toHaveLength(2)
    expect(kept).toContain('0.2.1')
  })

  it('never throws when the data directory is unusable', () => {
    const broken = join(root, 'not-a-dir')
    writeFileSync(broken, 'file')
    expect(() => backupDataOnVersionChange(broken, '0.2.0')).not.toThrow()
  })
})
