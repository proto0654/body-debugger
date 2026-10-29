// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readJsonEnvelope, writeJsonEnvelope } from '../../electron/main/persistence/json-file'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'body-debugger-json-'))
  file = join(dir, 'data', 'settings.json')
  mkdirSync(dirname(file), { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('JSON persistence envelope', () => {
  it('returns null for a missing file', () => {
    expect(readJsonEnvelope(file)).toBeNull()
  })

  it('round-trips a payload through an atomic write', () => {
    writeJsonEnvelope(file, { severity: 'soft' })

    expect(readJsonEnvelope(file)).toEqual({ severity: 'soft' })
    expect(existsSync(file)).toBe(true)
    expect(existsSync(`${file}.${process.pid}.tmp`)).toBe(false)
  })

  it('creates missing directories', () => {
    writeJsonEnvelope(join(dir, 'deep', 'nested', 'sessions.json'), [])
    expect(existsSync(join(dir, 'deep', 'nested', 'sessions.json'))).toBe(true)
  })

  it('stores the schema version in the envelope', () => {
    writeJsonEnvelope(file, { a: 1 })
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { version: number }
    expect(raw.version).toBe(1)
  })

  it('rejects corrupt JSON', () => {
    writeJsonEnvelope(file, { a: 1 })
    writeFileSync(file, '{ not json', 'utf8')
    expect(readJsonEnvelope(file)).toBeNull()
  })

  it('rejects an outdated schema version', () => {
    writeFileSync(file, JSON.stringify({ version: 0, data: { a: 1 } }), 'utf8')
    expect(readJsonEnvelope(file)).toBeNull()
  })

  it('rejects an envelope without data', () => {
    writeFileSync(file, JSON.stringify({ version: 1 }), 'utf8')
    expect(readJsonEnvelope(file)).toBeNull()
  })

  it('overwrites an existing payload', () => {
    writeJsonEnvelope(file, { value: 'first' })
    writeJsonEnvelope(file, { value: 'second' })
    expect(readJsonEnvelope(file)).toEqual({ value: 'second' })
  })
})
