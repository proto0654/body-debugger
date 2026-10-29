// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonEnvelope } from '../../electron/main/persistence/json-file'
import { MAX_PHOTO_BYTES } from '@shared/domain/photos'
import type { PhotoEntry } from '@shared/types/photo'

const holder = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => holder.dir }
}))

type Photos = typeof import('../../electron/main/photos')

async function loadPhotosModule(): Promise<Photos> {
  vi.resetModules()
  return import('../../electron/main/photos')
}

function photoDir(): string {
  return join(holder.dir, 'photos')
}

function dataPath(name: string): string {
  return join(holder.dir, 'data', name)
}

beforeEach(() => {
  holder.dir = mkdtempSync(join(tmpdir(), 'body-debugger-photos-'))
  mkdirSync(join(holder.dir, 'data'), { recursive: true })
})

afterEach(() => {
  rmSync(holder.dir, { recursive: true, force: true })
})

describe('main photo store', () => {
  it('writes bytes and metadata for a supported image', async () => {
    const photos = await loadPhotosModule()
    photos.loadPhotos()
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

    const entry = photos.addPhoto({
      bytes,
      mimeType: 'image/png',
      sessionId: 'session-1'
    })

    expect(entry).toMatchObject({
      mimeType: 'image/png',
      sizeBytes: 4,
      sessionId: 'session-1'
    })
    expect(entry?.fileName).toMatch(/^[0-9a-f-]+\.png$/)
    expect(existsSync(join(photoDir(), entry!.fileName))).toBe(true)
    expect(readFileSync(join(photoDir(), entry!.fileName))).toEqual(Buffer.from(bytes))
    expect(readJsonEnvelope<PhotoEntry[]>(dataPath('photos.json'))).toHaveLength(1)
    expect(photos.listPhotos()).toHaveLength(1)
  })

  it('rejects unsupported types, empty bytes and an oversized file', async () => {
    const photos = await loadPhotosModule()
    photos.loadPhotos()

    expect(photos.addPhoto({ bytes: new Uint8Array([1]), mimeType: 'image/gif' })).toBeNull()
    expect(photos.addPhoto({ bytes: new Uint8Array(), mimeType: 'image/png' })).toBeNull()
    expect(
      photos.addPhoto({
        bytes: new Uint8Array(MAX_PHOTO_BYTES + 1),
        mimeType: 'image/png'
      })
    ).toBeNull()
    expect(photos.listPhotos()).toEqual([])
  })

  it('removes the file and metadata entry', async () => {
    const photos = await loadPhotosModule()
    photos.loadPhotos()
    const entry = photos.addPhoto({ bytes: new Uint8Array([1, 2]), mimeType: 'image/jpeg' })!

    expect(photos.removePhoto(entry.id)).toBe(true)
    expect(existsSync(join(photoDir(), entry.fileName))).toBe(false)
    expect(readJsonEnvelope<PhotoEntry[]>(dataPath('photos.json'))).toEqual([])
    expect(photos.removePhoto('missing')).toBe(false)
  })

  it('drops malformed or missing metadata on load', async () => {
    const photos = await loadPhotosModule()
    writeFileSync(
      dataPath('photos.json'),
      JSON.stringify({
        version: 1,
        data: [
          {
            id: 'photo-1',
            fileName: 'photo-1.png',
            mimeType: 'image/png',
            sizeBytes: 4,
            createdAt: '2026-10-30T09:00:00.000Z'
          },
          { id: 'photo-2', mimeType: 'image/gif' },
          { id: 'photo-3', fileName: 'photo-3.png', mimeType: 'image/png', sizeBytes: 1 }
        ]
      })
    )

    photos.loadPhotos()

    expect(photos.listPhotos()).toEqual([])
  })

  it('resolves a stored photo by id', async () => {
    const photos = await loadPhotosModule()
    photos.loadPhotos()
    const entry = photos.addPhoto({ bytes: new Uint8Array([7]), mimeType: 'image/webp' })!

    expect(photos.getPhotoFile(entry.id)).toBe(join(photoDir(), entry.fileName))
    expect(photos.getPhotoFile('missing')).toBeNull()
  })
})
