import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { PERSISTENCE_VERSION, type PersistedEnvelope } from '../../../shared/types/persistence'

export function readJsonEnvelope<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as PersistedEnvelope<T>
    if (parsed?.version !== PERSISTENCE_VERSION || parsed.data === undefined) {
      console.warn(`[persistence] bad or outdated envelope: ${filePath}`)
      return null
    }
    return parsed.data
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.warn(`[persistence] failed to read ${filePath}:`, err)
    }
    return null
  }
}

/** Atomic write: temp file in same dir, then rename. */
export function writeJsonEnvelope<T>(filePath: string, data: T): void {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })

  const envelope: PersistedEnvelope<T> = {
    version: PERSISTENCE_VERSION,
    data
  }
  const tmpPath = `${filePath}.${process.pid}.tmp`
  writeFileSync(tmpPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8')
  renameSync(tmpPath, filePath)
}
