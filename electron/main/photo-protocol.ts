import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { getLaboratoryPhotoFile, getPhotoFile } from './photos'

/**
 * `photo://<id>` serves a stored progress photo to the renderer without exposing
 * filesystem paths. Only ids present in the main-owned photo metadata resolve;
 * anything else is a 404.
 */
export const PHOTO_SCHEME = 'photo'

/** Must run before `app.whenReady()` for the scheme to be treated as standard. */
export function registerPhotoScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PHOTO_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true }
    }
  ])
}

export function registerPhotoProtocol(): void {
  protocol.handle(PHOTO_SCHEME, async (request) => {
    let id: string
    try {
      id = new URL(request.url).hostname
    } catch {
      return new Response('Bad photo url', { status: 400 })
    }

    const file = getPhotoFile(id) ?? getLaboratoryPhotoFile(id)
    if (!file) return new Response('Photo not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}
