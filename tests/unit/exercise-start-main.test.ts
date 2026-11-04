// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dose } from '@shared/domain/dose'
import { upgradeExercise } from '@shared/domain/exercise-v2'

const state = vi.hoisted(() => ({ dir: '', popup: false, create: vi.fn(), focus: vi.fn(), closed: null as (() => void) | null }))
vi.mock('electron', () => ({ app: { getPath: () => state.dir }, ipcMain: { handle: vi.fn() }, powerMonitor: { getSystemIdleTime: () => 0 } }))
vi.mock('../../electron/main/windows/popup', () => ({
  createPopupWindow: () => { state.create(); state.popup = true; return { once: (_event: string, closed: () => void) => { state.closed = closed } } },
  getPopupWindow: () => state.popup ? { focus: state.focus } : null,
  closePopupWindow: () => { state.popup = false; state.closed?.(); state.closed = null }
}))
vi.mock('../../electron/main/tray', () => ({ setTrayState: vi.fn(), getTrayState: () => 'idle', setTrayPaused: vi.fn(), refreshTrayMenu: vi.fn(), refreshTrayAnimation: vi.fn() }))
vi.mock('../../electron/main/tray-portrait', () => ({ paintTrayPortrait: vi.fn(), stopTrayPortrait: vi.fn(), setTrayPortraitRepaint: vi.fn() }))
vi.mock('../../electron/main/broadcast', () => ({ broadcastToWindows: vi.fn(), notifyDataUpdated: vi.fn() }))
type Loop = typeof import('../../electron/main/trigger-loop')
let loop: Loop
let catalog: typeof import('../../electron/main/catalog-store')
let persistence: typeof import('../../electron/main/persistence')
let queue: typeof import('../../electron/main/queue-store')

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-04T12:00:00+03:00'))
  state.dir = mkdtempSync(join(tmpdir(), 'bd-start-'))
  state.popup = false
  state.closed = null
  state.create.mockReset()
  state.focus.mockReset()
  persistence = await import('../../electron/main/persistence')
  persistence.loadPersistence()
  catalog = await import('../../electron/main/catalog-store')
  catalog.loadCatalogStore()
  queue = await import('../../electron/main/queue-store')
  queue.loadQueueStore()
  loop = await import('../../electron/main/trigger-loop')
})
afterEach(() => { loop?.stopTriggerLoop(); vi.useRealTimers(); rmSync(state.dir, { recursive: true, force: true }) })

describe('main-owned exercise launch', () => {
  it('offers no recommendation when all exercises are disabled instead of exposing an unsafe fallback', () => {
    catalog.setCatalogOverrides(Object.fromEntries(catalog.getAvailableCatalog().map(ex => [ex.id, { disabled: true }])))
    expect(loop.previewNextExercise()).toBeNull()
    expect(state.create).not.toHaveBeenCalled()
  })
  it('previews without writing history or consuming a pin, then starts that exact recommendation once', () => {
    queue.saveBreakQueue({ slots: [{ kind: 'pin', exerciseId: 'wrist-circles' }], excludeToday: [], excludeDay: '' })
    const savedQueue = readFileSync(join(state.dir, 'data', 'queue.json'), 'utf8')
    const preview = loop.previewNextExercise()!
    expect(loop.previewNextExercise()!).toEqual(preview)
    expect(preview.exercise.id).toBe('wrist-circles')
    expect(readFileSync(join(state.dir, 'data', 'queue.json'), 'utf8')).toBe(savedQueue)
    expect(persistence.getSnapshot().sessions).toHaveLength(0)
    expect(loop.startExercise({ source: 'recommendation', token: preview.token })).toEqual({ status: 'started' })
    expect(loop.getActivePopup()?.exercise).toEqual(preview.exercise)
    expect(queue.getBreakQueue().slots[0]?.kind).toBe('empty')
    expect(loop.startExercise({ source: 'recommendation', token: preview.token })).toEqual({ status: 'focused' })
    expect(state.create).toHaveBeenCalledOnce()
    expect(state.focus).toHaveBeenCalledOnce()
  })
  it('rejects a stale recommendation after a settings change without consuming the queue', () => {
    const preview = loop.previewNextExercise()!
    persistence.updateSettings({ ...persistence.getSettings(), intervalMinutes: 30 })
    expect(loop.startExercise({ source: 'recommendation', token: preview.token }).status).toBe('stale')
    expect(state.create).not.toHaveBeenCalled()
    expect(loop.previewNextExercise()!.token).not.toBe(preview.token)
  })
  it('expires a recommendation after the underlying catalog changes', () => {
    const preview = loop.previewNextExercise()!
    catalog.setCatalogOverrides({ 'wrist-circles': { disabled: true } })
    expect(loop.startExercise({ source: 'recommendation', token: preview.token }).status).toBe('stale')
  })
  it('starts a selected exercise with the current dose and leaves the queue alone while paused', () => {
    queue.saveBreakQueue({ slots: [{ kind: 'pin', exerciseId: 'neck-tilts' }], excludeToday: [], excludeDay: '' })
    const before = queue.getBreakQueue()
    persistence.updateSettings({ ...persistence.getSettings(), paused: true, overrides: { 'wrist-circles': { scale: .75 } } })
    const raw = catalog.getAvailableCatalog().find(ex => ex.id === 'wrist-circles')!
    expect(loop.startExercise({ source: 'catalog', exerciseId: raw.id })).toEqual({ status: 'started' })
    expect(loop.getActivePopup()?.exercise.durationSec).toBe(dose(upgradeExercise(raw).timer, 45, .75))
    expect(queue.getBreakQueue()).toEqual(before)
    expect(persistence.getSnapshot().sessions).toHaveLength(0)
  })
  it('rejects missing, disabled, inventory-limited and physically excluded exercises', () => {
    expect(loop.startExercise({ source: 'catalog', exerciseId: 'missing' }).status).toBe('unavailable')
    catalog.setCatalogOverrides({ 'wrist-circles': { disabled: true } })
    expect(loop.startExercise({ source: 'catalog', exerciseId: 'wrist-circles' }).status).toBe('unavailable')
    const equipmentExercise = catalog.getAvailableCatalog().find(ex => ex.equipment?.length)!
    expect(loop.startExercise({ source: 'catalog', exerciseId: equipmentExercise.id }).status).toBe('unavailable')
    persistence.updateSettings({ ...persistence.getSettings(), limitations: ['neck'] })
    expect(loop.startExercise({ source: 'catalog', exerciseId: 'neck-tilts' }).status).toBe('unavailable')
    expect(state.create).not.toHaveBeenCalled()
  })
  it('blocks catalog launches during playback and its grace period', async () => {
    const playback = await import('../../electron/main/playback-coordinator')
    playback.beginPlayback('chronicle')
    expect(loop.startExercise({ source: 'catalog', exerciseId: 'wrist-circles' }).status).toBe('blocked')
    playback.endPlayback('chronicle')
    expect(loop.startExercise({ source: 'catalog', exerciseId: 'wrist-circles' }).status).toBe('blocked')
    expect(state.create).not.toHaveBeenCalled()
  })
  it('preserves a queued recommendation when window creation fails and permits retry', () => {
    queue.saveBreakQueue({ slots: [{ kind: 'pin', exerciseId: 'wrist-circles' }], excludeToday: [], excludeDay: '' })
    const preview = loop.previewNextExercise()!
    state.create.mockImplementationOnce(() => { throw new Error('Window creation failed') })
    expect(() => loop.startExercise({ source: 'recommendation', token: preview.token })).toThrow('Window creation failed')
    expect(loop.getActivePopup()).toBeNull()
    expect(queue.getBreakQueue().slots[0]).toEqual({ kind: 'pin', exerciseId: 'wrist-circles' })
    expect(loop.startExercise({ source: 'recommendation', token: preview.token }).status).toBe('started')
  })
})
