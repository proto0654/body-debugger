import type { PhotoEntry } from '../types/photo'

/**
 * Progress-photo rules (CONCEPT.md §10).
 *
 * The renderer picks a file and sends bytes over IPC; main validates the type,
 * size and id before writing anything. Photos are an optional layer: sessions
 * and the core cycle work with zero photos.
 */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024

/** One session keeps at most this many photos. */
export const MAX_SESSION_PHOTOS = 6

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

export function photoExtension(mimeType: string): string | null {
  return MIME_EXTENSIONS[mimeType] ?? null
}

export function isSupportedPhotoMime(mimeType: unknown): mimeType is string {
  return typeof mimeType === 'string' && mimeType in MIME_EXTENSIONS
}

export interface PhotoEntryInput {
  id?: unknown
  mimeType?: unknown
  sizeBytes?: unknown
  createdAt?: unknown
  sessionId?: unknown
  now?: Date
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function timestamp(value: unknown, now: Date): string | null {
  if (value === undefined) return now.toISOString()
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

export function buildPhotoEntry(input: PhotoEntryInput): PhotoEntry | null {
  const id = nonEmpty(input.id)
  if (!id) return null
  if (!isSupportedPhotoMime(input.mimeType)) return null
  if (
    typeof input.sizeBytes !== 'number' ||
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_PHOTO_BYTES
  ) {
    return null
  }

  const createdAt = timestamp(input.createdAt, input.now ?? new Date())
  if (!createdAt) return null

  const sessionId = nonEmpty(input.sessionId)
  return {
    id,
    fileName: `${id}.${photoExtension(input.mimeType)}`,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    createdAt,
    ...(sessionId ? { sessionId } : {})
  }
}

/** Untrusted `photoIds` from a session result: strings only, unique, capped. */
export function normalizePhotoIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const ids: string[] = []
  for (const entry of value) {
    const id = nonEmpty(entry)
    if (!id || ids.includes(id)) continue
    ids.push(id)
    if (ids.length >= MAX_SESSION_PHOTOS) break
  }
  return ids
}
