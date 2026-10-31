import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Minimal main-process log for installed builds, where nobody can read a console.
 * Console output is preserved; every log/warn/error line is mirrored to
 * `<userData>/logs/app.log` and rotated once at MAX_LOG_BYTES.
 */
const MAX_LOG_BYTES = 512 * 1024
const LOG_FILE_NAME = 'app.log'
const ROTATED_FILE_NAME = 'app.1.log'

let logDir = ''
let logFile = ''

function rotateIfNeeded(): void {
  try {
    if (statSync(logFile).size < MAX_LOG_BYTES) return
  } catch {
    return
  }
  try {
    rmSync(join(logDir, ROTATED_FILE_NAME), { force: true })
    renameSync(logFile, join(logDir, ROTATED_FILE_NAME))
  } catch {
    // A failed rotation must not stop the application or the current write.
  }
}

function formatArg(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack ?? value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function writeLine(level: string, args: unknown[]): void {
  if (!logFile) return
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${args.map(formatArg).join(' ')}\n`
  try {
    appendFileSync(logFile, line, 'utf8')
  } catch {
    // Logging is diagnostic only: a write failure must never break the app.
  }
}

/** Must run before any window exists; safe to call once per process. */
export function initLogging(rootPath: string): void {
  logDir = join(rootPath, 'logs')
  logFile = join(logDir, LOG_FILE_NAME)
  try {
    mkdirSync(logDir, { recursive: true })
  } catch {
    logFile = ''
    return
  }
  rotateIfNeeded()
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      writeLine(level, args)
    }
  }
}

export function getLogDir(): string {
  return logDir
}

export function logInfo(scope: string, message: string): void {
  console.log(`[${scope}] ${message}`)
}

export function logWarn(scope: string, message: string): void {
  console.warn(`[${scope}] ${message}`)
}

export function logError(scope: string, message: string, cause?: unknown): void {
  if (cause === undefined) console.error(`[${scope}] ${message}`)
  else console.error(`[${scope}] ${message}`, cause)
}
