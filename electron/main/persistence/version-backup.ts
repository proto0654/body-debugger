import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { logError, logInfo } from '../logger'

const VERSION_FILE = 'app-version.txt'
const BACKUP_ROOT = 'data-backup'
/** Keep the state from before the two most recent version changes. */
const MAX_BACKUPS = 2

function readPreviousVersion(markerPath: string): string | null {
  try {
    const value = readFileSync(markerPath, 'utf8').trim()
    return value === '' ? null : value
  } catch {
    return null
  }
}

function copyJsonFiles(dataDir: string, targetDir: string): number {
  mkdirSync(targetDir, { recursive: true })
  let copied = 0
  for (const name of readdirSync(dataDir)) {
    if (!name.endsWith('.json')) continue
    copyFileSync(join(dataDir, name), join(targetDir, name))
    copied += 1
  }
  return copied
}

function pruneBackups(backupRoot: string, keepPath: string): void {
  let entries: string[]
  try {
    entries = readdirSync(backupRoot)
  } catch {
    return
  }

  const backups = entries
    .map(name => ({ name, path: join(backupRoot, name) }))
    .filter((entry) => {
      try {
        return statSync(entry.path).isDirectory()
      } catch {
        return false
      }
    })
    .map(entry => ({ ...entry, mtime: statSync(entry.path).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime)

  for (const entry of backups.slice(MAX_BACKUPS)) {
    if (entry.path === keepPath) continue
    try {
      rmSync(entry.path, { recursive: true, force: true })
    } catch (cause) {
      logError('version-backup', `cannot remove ${entry.name}`, cause)
    }
  }
}

function hasFiles(dir: string): boolean {
  try {
    return readdirSync(dir).length > 0
  } catch {
    return false
  }
}

/**
 * Copy the stored JSON before a new version reads or rewrites it. A failed
 * backup must never block start-up, so every filesystem error is swallowed.
 */
export function backupDataOnVersionChange(dataDir: string, version: string): string | null {
  const markerPath = join(dataDir, VERSION_FILE)

  try {
    mkdirSync(dataDir, { recursive: true })
    const previous = readPreviousVersion(markerPath)
    if (!previous) {
      writeFileSync(markerPath, version, 'utf8')
      return null
    }
    if (previous === version) return null

    const backupPath = join(dirname(dataDir), BACKUP_ROOT, previous)
    if (hasFiles(backupPath)) {
      logInfo('version-backup', `${previous} backup already exists, keeping it`)
    } else {
      try {
        const copied = copyJsonFiles(dataDir, backupPath)
        logInfo('version-backup', `kept ${copied} file(s) from ${previous} in ${backupPath}`)
      } catch (cause) {
        logError('version-backup', `cannot write ${previous} backup`, cause)
      }
    }

    pruneBackups(join(dirname(dataDir), BACKUP_ROOT), backupPath)
    writeFileSync(markerPath, version, 'utf8')
    return backupPath
  } catch (cause) {
    logError('version-backup', 'backup skipped', cause)
    return null
  }
}
