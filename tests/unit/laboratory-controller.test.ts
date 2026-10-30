// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabCommand } from '@shared/domain/laboratory'

const mocks = vi.hoisted(() => ({
  dir: '', enabled: true, packaged: false, popup: false, closed: null as (() => void) | null,
  broadcast: vi.fn(), trayState: 'idle',
  dialogOpen: vi.fn(), dialogSave: vi.fn(), spawn: vi.fn()
}))
vi.mock('electron', () => ({
  app: { get isPackaged() { return mocks.packaged }, getPath: () => mocks.dir, getAppPath: () => mocks.dir },
  powerMonitor: { getSystemIdleTime: () => 0 },
  dialog: { showOpenDialog: mocks.dialogOpen, showSaveDialog: mocks.dialogSave }
}))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('../../electron/main/lab-environment', () => ({ isLabProcess: () => mocks.enabled, LAB_ARGUMENT: '--body-debugger-lab' }))
vi.mock('../../electron/main/broadcast', () => ({
  broadcastToWindows: mocks.broadcast, notifyDataUpdated: mocks.broadcast
}))
vi.mock('../../electron/main/windows/laboratory', () => ({ openLaboratoryWindow: vi.fn() }))
vi.mock('../../electron/main/windows/popup', () => ({
  getPopupWindow: () => mocks.popup ? { focus: vi.fn() } : null,
  createPopupWindow: () => { mocks.popup = true; return { once: (_event: string, handler: () => void) => { mocks.closed = handler } } },
  closePopupWindow: () => { mocks.popup = false; mocks.closed?.(); mocks.closed = null }
}))
vi.mock('../../electron/main/tray', () => ({
  setTrayState: (state: string) => { mocks.trayState = state }, getTrayState: () => mocks.trayState,
  setTrayPaused: vi.fn(), refreshTrayMenu: vi.fn(), refreshTrayAnimation: vi.fn()
}))

type Controller = typeof import('../../electron/main/laboratory')
type Loop = typeof import('../../electron/main/trigger-loop')
type Store = typeof import('../../electron/main/persistence')
let controller: Controller
let loop: Loop
let store: Store
async function command(value: LabCommand) { return controller.executeLabCommand(value) }

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 30, 12))
  mocks.dir = mkdtempSync(join(tmpdir(), 'body-debugger-lab-'))
  mocks.enabled = true; mocks.packaged = false; mocks.popup = false; mocks.closed = null; mocks.trayState = 'idle'
  mocks.spawn.mockReset()
  mocks.dialogOpen.mockReset(); mocks.dialogSave.mockReset(); mocks.broadcast.mockClear()
  controller = await import('../../electron/main/laboratory')
  loop = await import('../../electron/main/trigger-loop')
  store = await import('../../electron/main/persistence')
  controller.initializeLaboratory()
  store.loadPersistence()
  loop.startTriggerLoop()
})
afterEach(() => {
  controller.stopLaboratory(); loop.stopTriggerLoop(); vi.useRealTimers()
  vi.unstubAllEnvs()
  rmSync(mocks.dir, { recursive: true, force: true })
})

describe('main-owned laboratory', () => {
  it('launches a separate profile and removes Node-mode environment instead of setting it to an empty value', async () => {
    mocks.enabled = false
    vi.stubEnv('ELECTRON_RUN_AS_NODE', '1')
    mocks.spawn.mockImplementation(() => {
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('spawn'))
      return child
    })
    await controller.launchLaboratory()
    const [executable, args, options] = mocks.spawn.mock.calls[0]!
    expect(executable).toBe(process.execPath)
    expect(args).toEqual([mocks.dir, '--body-debugger-lab'])
    expect(options.windowsHide).toBe(true)
    expect(options.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE')
    expect(process.env.ELECTRON_RUN_AS_NODE).toBe('1')
  })
  it('rejects launcher failures and packaged launches', async () => {
    mocks.enabled = false
    mocks.spawn.mockImplementation(() => {
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('error', new Error('spawn failed')))
      return child
    })
    await expect(controller.launchLaboratory()).rejects.toThrow('spawn failed')
    mocks.packaged = true
    await expect(controller.launchLaboratory()).rejects.toThrow('development')
  })
  it('rejects destructive commands outside the isolated profile', async () => {
    mocks.enabled = false
    await expect(command({ action: 'scenario', id: 'growth' })).rejects.toThrow('isolated')
    expect(store.getSnapshot().sessions).toEqual([])
  })
  it('seeks back without future sessions, earned stages or future streak records leaking through', async () => {
    const state = await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'seek', cursor: state.plan!.events.length - 1 })
    expect(store.getSnapshot()).toMatchObject({ sessions: expect.any(Array), progress: { characterStage: 5, streak: { current: 40, max: 40 } } })
    await command({ action: 'seek', cursor: 0 })
    expect(store.getSnapshot()).toMatchObject({ sessions: [], progress: { characterStage: 0, streak: { current: 0, max: 0 } } })
    expect(store.getSnapshot().laboratory).toMatchObject({ running: false, silent: true })
  })
  it('does not trigger reminders or add missed sessions while a timeline is frozen', async () => {
    await command({ action: 'scenario', id: 'growth' })
    vi.advanceTimersByTime(4 * 3600000)
    expect(loop.getActivePopup()).toBeNull()
    expect(store.getSnapshot().sessions).toEqual([])
  })
  it('uses virtual days for persistence streaks and finds the empty-week gap by date', async () => {
    const state = await command({ action: 'scenario', id: 'return' })
    const start = new Date(state.plan!.events[0]!.at)
    start.setDate(start.getDate() + 10)
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    await command({ action: 'date', date })
    expect(store.getSnapshot().progress.streak).toEqual({ current: 0, max: 7 })
  })
  it('cancels an open popup before scrubbing so closing it cannot record a skip or a later timeout', async () => {
    await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'popup', preset: 'normal' })
    expect(loop.getActivePopup()).not.toBeNull()
    await command({ action: 'seek', cursor: 0 })
    vi.advanceTimersByTime(6 * 60000)
    expect(loop.getActivePopup()).toBeNull()
    expect(store.getSnapshot().sessions).toEqual([])
  })
  it('replays steps in main, pauses and stops at the end', async () => {
    const initial = await command({ action: 'scenario', id: 'return' })
    await command({ action: 'play', delayMs: 500 })
    vi.advanceTimersByTime(1000)
    expect(controller.getLabState().cursor).toBe(2)
    await command({ action: 'pause' })
    vi.advanceTimersByTime(1000)
    expect(controller.getLabState().cursor).toBe(2)
    await command({ action: 'seek', cursor: initial.plan!.events.length - 2 })
    await command({ action: 'play', delayMs: 500 })
    vi.advanceTimersByTime(500)
    expect(controller.getLabState()).toMatchObject({ cursor: initial.plan!.events.length - 1, playing: false })
  })
  it('stops playback immediately when the tray manually opens a real exercise', async () => {
    await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'play', delayMs: 500 })
    loop.triggerNow('manual')
    vi.advanceTimersByTime(1000)
    expect(controller.getLabState()).toMatchObject({ cursor: 0, playing: false, detached: true, activePopup: true })
    expect(store.getSnapshot().laboratory).toMatchObject({ running: true, silent: false })
    const active = loop.getActivePopup()!
    loop.handleSessionResult({ sessionId: active.sessionId, exerciseId: active.exercise.id, status: 'snoozed' })
    mocks.popup = false
    await command({ action: 'advance', seconds: 300 })
    expect(loop.getActivePopup()?.sessionId).not.toBe(active.sessionId)
    expect(loop.getActivePopup()).not.toBeNull()
  })
  it('injects a single write failure, keeps the popup retryable and saves exactly once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'popup', preset: 'soft' })
    const active = loop.getActivePopup()!
    const result = { sessionId: active.sessionId, exerciseId: active.exercise.id, status: 'done' as const }
    await command({ action: 'fail-save' })
    expect(loop.handleSessionResult(result)).toEqual({ saved: false })
    expect(store.getSnapshot().sessions).toHaveLength(0)
    expect(loop.getActivePopup()).not.toBeNull()
    expect(loop.handleSessionResult(result)).toEqual({ saved: true })
    expect(loop.handleSessionResult(result)).toEqual({ saved: true })
    expect(store.getSnapshot().sessions).toHaveLength(1)
    expect(controller.getLabState()).toMatchObject({ playing: false, interrupted: true })
    expect(controller.getLabState().plan!.events).toHaveLength(2)
  })
  it('advances to a popup timeout through the real session loop and never double-counts the close', async () => {
    await command({ action: 'popup', preset: 'medium' })
    await command({ action: 'advance', seconds: 300 })
    expect(store.getSnapshot().sessions).toHaveLength(1)
    expect(store.getSnapshot().sessions[0]!.status).toBe('missed')
    expect(loop.getActivePopup()).toBeNull()
    vi.advanceTimersByTime(300000)
    expect(store.getSnapshot().sessions.filter(session => session.status === 'missed')).toHaveLength(1)
  })
  it('places the stage-up popup one real completion before a new form', async () => {
    await command({ action: 'popup', preset: 'stage-up' })
    expect(store.getSnapshot().sessions.filter(session => session.status === 'done')).toHaveLength(2)
    expect(store.getSnapshot().progress.characterStage).toBe(0)
    const active = loop.getActivePopup()!
    loop.handleSessionResult({ sessionId: active.sessionId, exerciseId: active.exercise.id, status: 'done' })
    expect(store.getSnapshot().progress.characterStage).toBe(1)
  })
  it('saves resolved events and the cursor, then restores exactly that prefix', async () => {
    await command({ action: 'scenario', id: 'recovery' })
    await command({ action: 'seek', cursor: 20 })
    await command({ action: 'save' })
    const before = store.getSnapshot()
    await command({ action: 'reset' })
    await command({ action: 'restore' })
    expect(store.getSnapshot()).toEqual(before)
    expect(controller.getLabState().cursor).toBe(20)
    expect(JSON.parse(readFileSync(join(mocks.dir, 'data', 'laboratory-run.json'), 'utf8')).data.plan.version).toBe(1)
  })
  it('rejects an invalid imported cursor before changing the current timeline', async () => {
    const before = await command({ action: 'scenario', id: 'growth' })
    const path = join(mocks.dir, 'invalid.json')
    writeFileSync(path, JSON.stringify({ plan: before.plan, cursor: -1 }))
    mocks.dialogOpen.mockResolvedValue({ canceled: false, filePaths: [path] })
    await expect(command({ action: 'import' })).rejects.toThrow('position')
    expect(controller.getLabState().plan).toEqual(before.plan)
    expect(store.getSnapshot().sessions).toEqual([])
  })
  it.each([{ action: 'seek', cursor: NaN }, { action: 'advance', seconds: Infinity }, { action: 'idle', seconds: -1 },
    { action: 'play', delayMs: 0 }, { action: 'step', unit: 'bad', direction: 1 }] as unknown as LabCommand[])(
    'rejects invalid command %j', async value => {
      await command({ action: 'scenario', id: 'growth' })
      await expect(command(value)).rejects.toThrow()
      expect(store.getSnapshot().sessions).toEqual([])
    })
})
