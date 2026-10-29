import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { buildPhotoEntry } from '../../shared/domain/photos'
import type { PhotoEntry } from '../../shared/types/photo'
import { readJsonEnvelope, writeJsonEnvelope } from './persistence/json-file'
import { getPhotoDir, getPhotosPath } from './persistence/paths'

/**
 * Main-owned progress photos (docs: optional layer). Metadata goes to
 * `data/photos.json`; image bytes stay as files in `.userdata/photos/`.
 * The renderer only ever sees metadata and a `photo://<id>` URL.
 */

let photos: PhotoEntry[] = []

function clone(entry: PhotoEntry): PhotoEntry {
  return { ...entry }
}

function filePath(entry: PhotoEntry): string {
  return join(getPhotoDir(), entry.fileName)
}

function validStoredEntry(value: unknown): PhotoEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string' || typeof entry.fileName !== 'string') return null
  if (typeof entry.mimeType !== 'string') return null

  const built = buildPhotoEntry({
    id: entry.id,
    mimeType: entry.mimeType,
    sizeBytes: entry.sizeBytes,
    createdAt: entry.createdAt,
    sessionId: entry.sessionId
  })
  if (!built || built.fileName !== entry.fileName) return null
  if (!existsSync(filePath(built))) return null
  return built
}

export function loadPhotos(): void {
  const stored = readJsonEnvelope<unknown>(getPhotosPath())
  if (!Array.isArray(stored)) {
    photos = []
    return
  }

  const seen = new Set<string>()
  photos = []
  for (const value of stored) {
    const entry = validStoredEntry(value)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    photos.push(entry)
  }
}

export function listPhotos(): PhotoEntry[] {
  return photos.map(clone)
}

export function getPhoto(id: string): PhotoEntry | null {
  return photos.find((entry) => entry.id === id) ?? null
}

/** Absolute path for the custom `photo://` protocol; null when unknown. */
export function getPhotoFile(id: string): string | null {
  const entry = getPhoto(id)
  if (!entry) return null
  const path = filePath(entry)
  return existsSync(path) ? path : null
}

export interface AddPhotoInput {
  bytes?: unknown
  mimeType?: unknown
  sessionId?: unknown
}

/**
 * Validate untrusted renderer bytes, write the file, then the metadata entry.
 * A failed metadata write removes the orphan file so the next load stays clean.
 */
export function addPhoto(input: AddPhotoInput): PhotoEntry | null {
  const bytes = input.bytes
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) return null

  const id = randomUUID()
  const entry = buildPhotoEntry({
    id,
    mimeType: input.mimeType,
    sizeBytes: bytes.byteLength,
    sessionId: input.sessionId
  })
  if (!entry) return null

  try {
    mkdirSync(getPhotoDir(), { recursive: true })
    writeFileSync(filePath(entry), bytes)
    photos = [...photos, entry]
    writeJsonEnvelope(getPhotosPath(), photos)
    return clone(entry)
  } catch (error) {
    console.error('[photos] failed to save a photo', error)
    try {
      rmSync(filePath(entry), { force: true })
    } catch {
      // Best effort: the metadata write already failed.
    }
    photos = photos.filter((candidate) => candidate.id !== entry.id)
    return null
  }
}

export function removePhoto(id: string): boolean {
  const entry = photos.find((candidate) => candidate.id === id)
  if (!entry) return false

  photos = photos.filter((candidate) => candidate.id !== id)
  try {
    rmSync(filePath(entry), { force: true })
    writeJsonEnvelope(getPhotosPath(), photos)
    return true
  } catch (error) {
    console.error('[photos] failed to remove a photo', error)
    return false
  }
}


