/**
 * Renderer-side URL for the main-owned photo protocol. The id is encoded so a
 * crafted value cannot change the host/segment structure of the URL.
 */
export function photoUrl(id: string): string {
  return `photo://${encodeURIComponent(id)}`
}
