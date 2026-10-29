// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  MAX_PHOTO_BYTES,
  MAX_SESSION_PHOTOS,
  buildPhotoEntry,
  isSupportedPhotoMime,
  normalizePhotoIds,
  photoExtension
} from '@shared/domain/photos'

const ID = '0d6c2f9e-6f0a-4a5a-9a4d-4f4f8f4b9c11'

describe('photo rules', () => {
  it('accepts the documented image formats only', () => {
    expect(isSupportedPhotoMime('image/jpeg')).toBe(true)
    expect(isSupportedPhotoMime('image/png')).toBe(true)
    expect(isSupportedPhotoMime('image/webp')).toBe(true)
    expect(isSupportedPhotoMime('image/gif')).toBe(false)
    expect(isSupportedPhotoMime('image/heic')).toBe(false)
    expect(isSupportedPhotoMime('text/plain')).toBe(false)
    expect(photoExtension('image/jpeg')).toBe('jpg')
    expect(photoExtension('image/gif')).toBeNull()
  })

  it('builds an entry with a deterministic file name', () => {
    const entry = buildPhotoEntry({
      id: ID,
      mimeType: 'image/png',
      sizeBytes: 1024,
      createdAt: '2026-10-30T09:00:00.000Z'
    })

    expect(entry).toEqual({
      id: ID,
      fileName: `${ID}.png`,
      mimeType: 'image/png',
      sizeBytes: 1024,
      createdAt: '2026-10-30T09:00:00.000Z'
    })
  })

  it('defaults createdAt to now and keeps an optional session id', () => {
    const now = new Date('2026-10-30T10:00:00.000Z')
    const entry = buildPhotoEntry({
      id: ID,
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      sessionId: 'session-1',
      now
    })

    expect(entry?.createdAt).toBe(now.toISOString())
    expect(entry?.sessionId).toBe('session-1')
  })

  it('rejects a missing id, an unsupported type and an empty/oversized file', () => {
    expect(buildPhotoEntry({ id: '', mimeType: 'image/png', sizeBytes: 10 })).toBeNull()
    expect(buildPhotoEntry({ id: ID, mimeType: 'image/gif', sizeBytes: 10 })).toBeNull()
    expect(buildPhotoEntry({ id: ID, mimeType: 'image/png', sizeBytes: 0 })).toBeNull()
    expect(
      buildPhotoEntry({ id: ID, mimeType: 'image/png', sizeBytes: MAX_PHOTO_BYTES + 1 })
    ).toBeNull()
  })

  it('rejects a malformed timestamp', () => {
    expect(
      buildPhotoEntry({
        id: ID,
        mimeType: 'image/png',
        sizeBytes: 10,
        createdAt: 'not-a-date'
      })
    ).toBeNull()
  })

  it('normalizes session photo ids: strings only, unique, capped', () => {
    expect(
      normalizePhotoIds(['a', 'b', 'a', '', 42, null, 'c', 'd', 'e', 'f', 'g', 'h'])
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(MAX_SESSION_PHOTOS).toBe(6)
    expect(normalizePhotoIds(null)).toEqual([])
    expect(normalizePhotoIds('a')).toEqual([])
  })
})
