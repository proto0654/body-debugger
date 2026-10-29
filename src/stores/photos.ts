import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PhotoEntry } from '@shared/types/photo'

/** Optional photo layer projection: metadata is hydrated from main. */
export const usePhotosStore = defineStore('photos', () => {
  const entries = ref<PhotoEntry[]>([])

  const latest = computed(() => entries.value[0] ?? null)

  function hydrate(photos: PhotoEntry[]): void {
    entries.value = photos.map((photo) => ({ ...photo }))
  }

  async function refresh(): Promise<void> {
    const photos = await window.api?.listPhotos?.()
    if (photos) hydrate(photos)
  }

  /** Reads the picked file in the renderer, main validates + writes it. */
  async function add(file: File, sessionId?: string): Promise<PhotoEntry | null> {
    if (!window.api?.addPhoto) return null

    const bytes = new Uint8Array(await file.arrayBuffer())
    const entry = await window.api.addPhoto({ bytes, mimeType: file.type, sessionId })
    if (entry) await refresh()
    return entry
  }

  async function remove(id: string): Promise<void> {
    const result = await window.api?.removePhoto?.({ id })
    if (result?.photos) hydrate(result.photos)
  }

  function forSession(sessionId: string): PhotoEntry[] {
    return entries.value.filter((photo) => photo.sessionId === sessionId)
  }

  return {
    entries,
    latest,
    hydrate,
    refresh,
    add,
    remove,
    forSession
  }
})
