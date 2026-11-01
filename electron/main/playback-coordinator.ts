import { ipcMain } from 'electron'
import {
  emptyPlaybackCoordinatorState,
  playbackBlocksReminders,
  PLAYBACK_REMINDER_GRACE_MS,
  type PlaybackCoordinatorState,
  type PlaybackOwner
} from '../../shared/domain/playback-coordinator'
import { IpcChannels } from '../../shared/types/events'
import { broadcastToWindows } from './broadcast'
import { nowMs } from '../../shared/domain/clock'

let state: PlaybackCoordinatorState = emptyPlaybackCoordinatorState()
let onChanged: (() => void) | null = null
const stoppers: Partial<Record<PlaybackOwner, () => void>> = {}

export function getPlaybackCoordinatorState(): PlaybackCoordinatorState {
  return { ...state }
}

export function isReminderDeferred(at = nowMs()): boolean {
  return playbackBlocksReminders(state, at)
}

export function registerPlaybackStopper(owner: PlaybackOwner, stop: () => void): void {
  stoppers[owner] = stop
}

function publish(): void {
  broadcastToWindows(IpcChannels.PlaybackChanged, getPlaybackCoordinatorState())
  onChanged?.()
}

/**
 * Claim the shared playback slot. Starting a different owner stops the previous
 * run so chronicle and laboratory never play in parallel.
 */
export function beginPlayback(owner: PlaybackOwner): PlaybackCoordinatorState {
  if (state.busy && state.owner && state.owner !== owner) {
    stoppers[state.owner]?.()
  }
  state = { owner, busy: true, graceUntil: null }
  publish()
  return getPlaybackCoordinatorState()
}

/** Release ownership and start the post-run reminder grace window. */
export function endPlayback(owner: PlaybackOwner): PlaybackCoordinatorState {
  if (state.owner !== owner) return getPlaybackCoordinatorState()
  const graceUntil = nowMs() + PLAYBACK_REMINDER_GRACE_MS
  state = { owner: null, busy: false, graceUntil }
  publish()
  setTimeout(() => {
    if (getPlaybackCoordinatorState().graceUntil !== graceUntil) return
    void import('./trigger-loop').then((module) => module.flushDeferredReminder())
  }, PLAYBACK_REMINDER_GRACE_MS + 25)
  return getPlaybackCoordinatorState()
}

export function setPlaybackCoordinatorListener(listener: (() => void) | null): void {
  onChanged = listener
}

export function registerPlaybackCoordinatorIpc(): void {
  ipcMain.handle(IpcChannels.PlaybackGetState, () => getPlaybackCoordinatorState())
  ipcMain.handle(IpcChannels.PlaybackBegin, (_event, owner: PlaybackOwner) => {
    if (owner !== 'chronicle' && owner !== 'laboratory') throw new Error('Invalid playback owner')
    return beginPlayback(owner)
  })
  ipcMain.handle(IpcChannels.PlaybackEnd, (_event, owner: PlaybackOwner) => {
    if (owner !== 'chronicle' && owner !== 'laboratory') throw new Error('Invalid playback owner')
    return endPlayback(owner)
  })
}
