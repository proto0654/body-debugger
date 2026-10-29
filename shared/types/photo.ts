/** Optional progress photos (CONCEPT.md §10). Files live in main; only metadata crosses IPC. */
export interface PhotoEntry {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  /** Session the photo was attached to, when it came from the popup. */
  sessionId?: string
}
