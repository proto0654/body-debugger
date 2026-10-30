/**
 * The laboratory launcher is dev-only (docs/TESTING.md). It is enabled by the Vite dev
 * build or explicitly with `VITE_DEBUG_PANEL=1`; production renderers hide it unless main identifies a laboratory profile.
 */
export function isDebugEnabled(
  env: { DEV?: boolean; VITE_DEBUG_PANEL?: string | boolean } = import.meta.env
): boolean {
  return env.DEV === true || env.VITE_DEBUG_PANEL === '1' || env.VITE_DEBUG_PANEL === true
}
