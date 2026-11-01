import { ipcMain } from 'electron'
import {
  IpcChannels,
  type PhotoAddPayload,
  type PhotoRemovePayload,
  type PhotosUpdatedPayload
} from '../../../shared/types/events'
import { broadcastToWindows } from '../broadcast'
import { addPhoto, listPhotos, removePhoto } from '../photos'

export function listPhotosRequest(): ReturnType<typeof listPhotos> {
  return listPhotos()
}

export function addPhotoRequest(payload: PhotoAddPayload): ReturnType<typeof addPhoto> {
  const entry = addPhoto({
    bytes: payload?.bytes,
    mimeType: payload?.mimeType,
    sessionId: payload?.sessionId
  })
  if (entry) {
    const updated: PhotosUpdatedPayload = { photos: listPhotos() }
    broadcastToWindows(IpcChannels.PhotosUpdated, updated)
  }
  return entry
}

export function removePhotoRequest(payload: PhotoRemovePayload): { removed: boolean; photos: ReturnType<typeof listPhotos> } {
  const removed = removePhoto(payload?.id)
  const photos = listPhotos()
  const updated: PhotosUpdatedPayload = { photos }
  broadcastToWindows(IpcChannels.PhotosUpdated, updated)
  return { removed, photos }
}

/** Optional photo layer: main owns the files, renderers only send bytes / ids. */
export function registerPhotoIpc(): void {
  ipcMain.handle(IpcChannels.PhotoList, () => listPhotosRequest())

  ipcMain.handle(IpcChannels.PhotoAdd, (_event, payload: PhotoAddPayload) => addPhotoRequest(payload))

  ipcMain.handle(IpcChannels.PhotoRemove, (_event, payload: PhotoRemovePayload) => removePhotoRequest(payload))
}
