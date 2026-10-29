import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePhotosStore } from '@/stores/photos'
import type { PhotoEntry } from '@shared/types/photo'
import type { PhotoAddPayload } from '@shared/types/events'

const entry: PhotoEntry = {
  id: 'photo-1',
  fileName: 'photo-1.png',
  mimeType: 'image/png',
  sizeBytes: 2,
  createdAt: '2026-10-30T09:00:00.000Z',
  sessionId: 'session-1'
}

const listPhotos = vi.fn(async () => [entry])
const addPhoto = vi.fn(async (_payload: PhotoAddPayload) => entry)
const removePhoto = vi.fn(async () => ({ removed: true, photos: [] as PhotoEntry[] }))

beforeEach(() => {
  setActivePinia(createPinia())
  listPhotos.mockClear()
  addPhoto.mockClear()
  removePhoto.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { listPhotos, addPhoto, removePhoto }
  })
})

describe('photos store', () => {
  it('hydrates a copy of the metadata', () => {
    const source = [{ ...entry }]
    const store = usePhotosStore()
    store.hydrate(source)

    source[0].id = 'changed'
    expect(store.entries[0].id).toBe('photo-1')
  })

  it('refreshes from main and exposes the latest photo', async () => {
    const store = usePhotosStore()
    await store.refresh()

    expect(listPhotos).toHaveBeenCalledTimes(1)
    expect(store.entries).toEqual([entry])
    expect(store.latest?.id).toBe('photo-1')
    expect(store.forSession('session-1')).toHaveLength(1)
    expect(store.forSession('other')).toHaveLength(0)
  })

  it('sends picked bytes to main and refreshes the list', async () => {
    const store = usePhotosStore()
    const file = new File([new Uint8Array([1, 2])], 'photo.png', { type: 'image/png' })

    const added = await store.add(file, 'session-1')

    expect(added).toEqual(entry)
    expect(addPhoto).toHaveBeenCalledTimes(1)
    const payload = addPhoto.mock.calls[0][0]
    expect(payload.mimeType).toBe('image/png')
    expect(payload.sessionId).toBe('session-1')
    expect(Array.from(payload.bytes)).toEqual([1, 2])
    expect(listPhotos).toHaveBeenCalledTimes(1)
  })

  it('removes a photo and adopts the returned list', async () => {
    const store = usePhotosStore()
    store.hydrate([entry])

    await store.remove('photo-1')

    expect(removePhoto).toHaveBeenCalledWith({ id: 'photo-1' })
    expect(store.entries).toEqual([])
  })

  it('stays empty when the preload bridge is absent', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    const store = usePhotosStore()

    await expect(store.refresh()).resolves.toBeUndefined()
    await expect(
      store.add(new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }))
    ).resolves.toBeNull()
    expect(store.entries).toEqual([])
  })
})
