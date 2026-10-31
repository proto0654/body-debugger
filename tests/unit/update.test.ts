import { describe, expect, it } from 'vitest'
import {
  installBlocker,
  shouldCheckForUpdates,
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
