import { ipcMain } from 'electron'
import {
  IpcChannels,
  type PhotoAddPayload,
  type PhotoRemovePayload,
  type PhotosUpdatedPayload
} from '../../../shared/types/events'
import { broadcastToWindows } from '../broadcast'
import { addPhoto, listPhotos, removePhoto } from '../photos'

/** Optional photo layer: main owns the files, renderers only send bytes / ids. */
export function registerPhotoIpc(): void {
  ipcMain.handle(IpcChannels.PhotoList, async () => listPhotos())

  ipcMain.handle(IpcChannels.PhotoAdd, async (_event, payload: PhotoAddPayload) => {
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
  })

  ipcMain.handle(IpcChannels.PhotoRemove, async (_event, payload: PhotoRemovePayload) => {
    const removed = removePhoto(payload?.id)
    const photos = listPhotos()
    const updated: PhotosUpdatedPayload = { photos }
    broadcastToWindows(IpcChannels.PhotosUpdated, updated)
    return { removed, photos }
  })
}
