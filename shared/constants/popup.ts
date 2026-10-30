/**
 * Popup window geometry (CONCEPT.md §4).
 * Shared because main sizes the window and the renderer grows it when the
 * optional session-details block expands.
 */

export const POPUP_WIDTH = 320
export const POPUP_BASE_HEIGHT = 260
/** Height with the details row visible but collapsed. */
export const POPUP_EXTRAS_COLLAPSED_HEIGHT = 290
/** Height with the optional details block expanded. */
export const POPUP_EXTRAS_HEIGHT = 380
export const POPUP_MAX_HEIGHT = 420
/** Gap between the popup and the screen edge. */
export const POPUP_SCREEN_MARGIN = 16
