/**
 * Update feed rules shared by the main process and the «О программе» panel.
 * electron-updater owns the actual download and install; this module only
 * decides when a check is due and how progress is shown.
 */
export type UpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'current'
  | 'downloading'
  | 'ready'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  /** 0–100 while downloading, 100 when ready, null otherwise. */
  progressPercent: number | null
  /** ISO timestamp of the last completed check, null before the first one. */
  checkedAt: string | null
  /** Russian message for a failed manual check; background failures stay silent. */
  error: string | null
}

export const UPDATE_FIRST_CHECK_DELAY_MS = 25_000
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** Background checks run on a schedule; a manual check bypasses this gate. */
export function shouldCheckForUpdates(input: {
  lastCheckedAt: number | null
  now: number
  intervalMs?: number
}): boolean {
  if (input.lastCheckedAt === null) return true
  const interval = input.intervalMs ?? UPDATE_CHECK_INTERVAL_MS
  return input.now - input.lastCheckedAt >= interval
}

export function updateProgressPercent(transferred: number, total: number): number | null {
  if (!Number.isFinite(transferred) || !Number.isFinite(total) || total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((transferred / total) * 100)))
}

/** A restart is refused when nothing is downloaded or an exercise popup is open. */
export type InstallBlocker = 'not-ready' | 'popup-open' | null

export function installBlocker(input: { status: UpdateStatus; popupOpen: boolean }): InstallBlocker {
  if (input.status !== 'ready') return 'not-ready'
  if (input.popupOpen) return 'popup-open'
  return null
}
