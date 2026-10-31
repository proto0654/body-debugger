import { describe, expect, it } from 'vitest'
import {
  installBlocker,
  shouldCheckForUpdates,
  shouldCloseUpdatePrompt,
  shouldShowUpdatePrompt,
  updateProgressPercent,
  UPDATE_CHECK_INTERVAL_MS
} from '../../shared/domain/update'

describe('update check schedule', () => {
  it('checks immediately when no check has happened yet', () => {
    expect(shouldCheckForUpdates({ lastCheckedAt: null, now: 1_000 })).toBe(true)
  })

  it('does not repeat a background check inside the interval', () => {
    const now = 10_000 + 60_000
    expect(shouldCheckForUpdates({ lastCheckedAt: 10_000, now })).toBe(false)
  })

  it('checks again once the interval has passed', () => {
    const lastCheckedAt = 10_000
    expect(shouldCheckForUpdates({ lastCheckedAt, now: lastCheckedAt + UPDATE_CHECK_INTERVAL_MS - 1 })).toBe(false)
    expect(shouldCheckForUpdates({ lastCheckedAt, now: lastCheckedAt + UPDATE_CHECK_INTERVAL_MS })).toBe(true)
  })

  it('accepts a custom interval so a test does not depend on the production value', () => {
    expect(shouldCheckForUpdates({ lastCheckedAt: 0, now: 5_000, intervalMs: 5_000 })).toBe(true)
  })
})

describe('update progress', () => {
  it('reports whole percentages', () => {
    expect(updateProgressPercent(0, 200)).toBe(0)
    expect(updateProgressPercent(50, 200)).toBe(25)
    expect(updateProgressPercent(200, 200)).toBe(100)
  })

  it('clamps impossible values instead of rendering them', () => {
    expect(updateProgressPercent(300, 200)).toBe(100)
    expect(updateProgressPercent(-10, 200)).toBe(0)
  })

  it('returns null when the total size is unknown', () => {
    expect(updateProgressPercent(10, 0)).toBeNull()
    expect(updateProgressPercent(Number.NaN, 100)).toBeNull()
    expect(updateProgressPercent(10, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('install gating', () => {
  it('refuses to restart before a version is downloaded', () => {
    expect(installBlocker({ status: 'downloading', popupOpen: false })).toBe('not-ready')
    expect(installBlocker({ status: 'current', popupOpen: true })).toBe('not-ready')
  })

  it('never interrupts an open exercise popup', () => {
    expect(installBlocker({ status: 'ready', popupOpen: true })).toBe('popup-open')
  })

  it('allows the restart once the update is ready and no popup is open', () => {
    expect(installBlocker({ status: 'ready', popupOpen: false })).toBeNull()
  })
})

describe('update prompt', () => {
  const base = {
    status: 'downloading' as const,
    availableVersion: '0.3.0',
    dismissedVersion: null,
    popupOpen: false,
    promptVisible: false
  }

  it('opens while an update is downloading or ready', () => {
    expect(shouldShowUpdatePrompt(base)).toBe(true)
    expect(shouldShowUpdatePrompt({ ...base, status: 'ready' })).toBe(true)
  })

  it('does not open without a concrete version or in an idle state', () => {
    expect(shouldShowUpdatePrompt({ ...base, availableVersion: null })).toBe(false)
    expect(shouldShowUpdatePrompt({ ...base, status: 'current' })).toBe(false)
    expect(shouldShowUpdatePrompt({ ...base, status: 'error' })).toBe(false)
  })

  it('never competes with an exercise popup or an already visible prompt', () => {
    expect(shouldShowUpdatePrompt({ ...base, popupOpen: true })).toBe(false)
    expect(shouldShowUpdatePrompt({ ...base, promptVisible: true })).toBe(false)
  })

  it('keeps a dismissed version quiet for the rest of the run', () => {
    expect(shouldShowUpdatePrompt({ ...base, dismissedVersion: '0.3.0' })).toBe(false)
    expect(shouldShowUpdatePrompt({ ...base, dismissedVersion: '0.2.9' })).toBe(true)
  })

  it('closes when there is no download in flight', () => {
    expect(shouldCloseUpdatePrompt('downloading')).toBe(false)
    expect(shouldCloseUpdatePrompt('ready')).toBe(false)
    expect(shouldCloseUpdatePrompt('checking')).toBe(true)
    expect(shouldCloseUpdatePrompt('current')).toBe(true)
    expect(shouldCloseUpdatePrompt('error')).toBe(true)
    expect(shouldCloseUpdatePrompt('disabled')).toBe(true)
  })
})
