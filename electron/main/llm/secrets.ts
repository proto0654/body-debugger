import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { safeStorage } from 'electron'
import { getDataDir } from '../persistence/paths'

const KEY_FILE = 'llm-api-key.enc'

function keyPath(): string {
  return join(getDataDir(), KEY_FILE)
}

export function hasKey(): boolean {
  return existsSync(keyPath())
}

/** Main-process only; never expose through IPC. */
export function readKey(): string | null {
  if (!hasKey()) return null
  const raw = readFileSync(keyPath())
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(raw)
    } catch {
      return null
    }
  }
  return raw.toString('utf8')
}

export function setKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    clearKey()
    return
  }
  mkdirSync(getDataDir(), { recursive: true })
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(trimmed)
    : Buffer.from(trimmed, 'utf8')
  writeFileSync(keyPath(), payload)
}

export function clearKey(): void {
  if (existsSync(keyPath())) unlinkSync(keyPath())
}
