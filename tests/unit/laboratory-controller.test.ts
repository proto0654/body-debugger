// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabCommand } from '@shared/domain/laboratory'
import { LAB_SCENARIOS, labSummary } from '@shared/domain/laboratory'
import type { LabDriverCommand } from '@shared/domain/laboratory-playback'
import { makeExercise } from '../fixtures'
import type { LabVisualPreview } from '@shared/domain/laboratory-preview'

const mocks = vi.hoisted(() => ({
  dir: '', enabled: true, packaged: false, popup: false, closed: null as (() => void) | null,
  broadcast: vi.fn(), trayState: 'idle',
  dialogOpen: vi.fn(), dialogSave: vi.fn(), spawn: vi.fn(), driver: vi.fn(), previewOpen: vi.fn(), previewClose: vi.fn(),
  dashboard: null as null | { close: () => void; isDestroyed: () => boolean; isVisible: () => boolean },
  createDashboard: vi.fn(), getDashboard: vi.fn(), spawnChild: null as EventEmitter | null
}))
vi.mock('electron', () => ({
  app: { get isPackaged() { return mocks.packaged }, getPath: () => mocks.dir, getAppPath: () => mocks.dir, on: vi.fn() },
  powerMonitor: { getSystemIdleTime: () => 0 },
  dialog: { showOpenDialog: mocks.dialogOpen, showSaveDialog: mocks.dialogSave }
}))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('../../electron/main/lab-environment', () => ({ isLabProcess: () => mocks.enabled, LAB_ARGUMENT: '--body-debugger-lab' }))
vi.mock('../../electron/main/broadcast', () => ({
  broadcastToWindows: mocks.broadcast, notifyDataUpdated: mocks.broadcast
}))
vi.mock('../../electron/main/windows/dashboard', () => ({
  createDashboardWindow: mocks.createDashboard, getDashboardWindow: mocks.getDashboard
}))
vi.mock('../../electron/main/windows/laboratory-preview', () => ({ openLabPreviewWindow: mocks.previewOpen, closeLabPreviewWindow: mocks.previewClose }))
vi.mock('../../electron/main/windows/popup', () => ({
  getPopupWindow: () => mocks.popup ? { focus: vi.fn(), webContents: { send: mocks.driver } } : null,
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
  mocks.dashboard = null; mocks.spawnChild = null
  mocks.createDashboard.mockReset()
  mocks.getDashboard.mockReset(); mocks.getDashboard.mockImplementation(() => mocks.dashboard)
  mocks.spawn.mockReset()
  mocks.previewOpen.mockReset(); mocks.previewClose.mockReset()
  mocks.driver.mockReset()
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
  it('opens and updates visual preview without changing history, preferences, playback or the real popup', async () => {
    const preview: LabVisualPreview = { packId: 'engineer', stage: 5, branch: 'power', build: 'stocky',
      condition: 3, emotion: 'happy', popup: 'done', sequence: 1 }
    const before = store.getSnapshot()
    const playback = controller.getLabState().playback
    await command({ action: 'visual-preview', preview, open: true })
    expect(mocks.previewOpen).toHaveBeenCalledOnce()
    expect(controller.getLabState().visualPreview).toEqual(preview)
    await command({ action: 'visual-preview', preview: { ...preview, popup: 'error', sequence: 2 } })
    expect(mocks.previewOpen).toHaveBeenCalledOnce()
    expect(controller.getLabState().visualPreview?.popup).toBe('error')
    expect(store.getSnapshot()).toEqual(before)
    expect(controller.getLabState().playback).toEqual(playback)
    expect(loop.getActivePopup()).toBeNull()
    await command({ action: 'close-preview' })
    expect(controller.getLabState().visualPreview).toBeNull()
    expect(mocks.previewClose).toHaveBeenCalledOnce()
    mocks.enabled = false
    await expect(command({ action: 'visual-preview', preview, open: true })).rejects.toThrow('isolated')
  })

  it('rejects malformed preview data before creating a native window', async () => {
    await expect(command({ action: 'visual-preview', preview: { stage: 9 } as unknown as LabVisualPreview, open: true }))
      .rejects.toThrow('Invalid visual preview')
    expect(mocks.previewOpen).not.toHaveBeenCalled()
    expect(controller.getLabState().visualPreview).toBeNull()
  })
  it('rolls back visual state if the native preview window cannot open', async () => {
    mocks.previewOpen.mockImplementationOnce(() => { throw new Error('window failed') })
    await expect(command({ action: 'visual-preview', open: true, preview: { packId: 'engineer', stage: 0, build: 'average',
      branch: 'neutral', condition: 0, emotion: 'neutral', popup: 'ready', sequence: 0 } })).rejects.toThrow('window failed')
    expect(controller.getLabState().visualPreview).toBeNull()
    expect(loop.getActivePopup()).toBeNull()
  })
  it('saves and restores a branch using an approved exercise without trusting unknown imported IDs', async () => {
    const custom = await import('../../electron/main/custom-exercises')
    expect(custom.addCustomExercise(makeExercise({ id: 'approved-lab-exercise' }))).not.toBeNull()
    await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'popup', preset: 'normal', exerciseId: 'approved-lab-exercise' })
    const active = loop.getActivePopup()!
    loop.handleSessionResult({ sessionId: active.sessionId, exerciseId: active.exercise.id, status: 'skipped' })
    mocks.popup = false
    await command({ action: 'save' })
    await command({ action: 'reset-history' })
    await command({ action: 'restore' })
    expect(store.getSnapshot().sessions.at(-1)?.exerciseId).toBe('approved-lab-exercise')
    custom.removeCustomExercise('approved-lab-exercise')
    await expect(command({ action: 'restore' })).rejects.toThrow('Invalid laboratory session')
  })
  it('opens a chosen catalog exercise without changing current normal-popup preferences', async () => {
    store.updateSettings({ ...store.getSnapshot().settings, severity: 'hardcore', sessionExtras: { enabled: true } })
    const before = store.getSnapshot().settings
    await command({ action: 'popup', preset: 'normal', exerciseId: 'neck-tilts' })
    expect(loop.getActivePopup()?.exercise.id).toBe('neck-tilts')
    expect(store.getSnapshot().settings).toEqual(before)
  })

  it('rejects an unknown exercise before changing history or preferences', async () => {
    const before = store.getSnapshot()
    await expect(command({ action: 'popup', preset: 'stage-up', exerciseId: '../missing' })).rejects.toThrow('Unknown laboratory exercise')
    expect(store.getSnapshot()).toEqual(before)
    expect(loop.getActivePopup()).toBeNull()
  })

  it('restores scenario preferences without moving the cursor or rewriting its history', async () => {
    const initial = await command({ action: 'scenario', id: 'growth' })
    const originalSettings = structuredClone(initial.plan!.settings)
    await command({ action: 'seek', cursor: 5 })
    const history = store.getSnapshot().sessions
    store.updateSettings({ ...store.getSnapshot().settings, characterPackId: 'engineer', severity: 'soft' })
    store.updateProgress({ ...store.getSnapshot().progress, characterBuild: 'stocky' })
    controller.rememberLabPreferences()
    await command({ action: 'seek', cursor: 5 })
    expect(store.getSnapshot().settings.characterPackId).toBe('engineer')
    await command({ action: 'restore-preferences' })
    expect(controller.getLabState().cursor).toBe(5)
    expect(store.getSnapshot().sessions).toEqual(history)
    expect(store.getSnapshot().settings).toEqual(originalSettings)
    expect(store.getSnapshot().progress.characterBuild).toBe('average')
  })

  it('keeps the live sound preference out of the scenario snapshot', async () => {
    const base = store.getSnapshot().settings
    store.updateSettings({ ...base, sound: { ...base.sound, enabled: false } })
    await command({ action: 'scenario', id: 'growth' })
    // The plan now carries the muted block; enabling sound must survive a seek.
    store.updateSettings({ ...store.getSnapshot().settings, sound: { ...base.sound, enabled: true } })

    await command({ action: 'seek', cursor: 2 })

    expect(store.getSnapshot().settings.sound.enabled).toBe(true)
    expect(store.getSnapshot().settings.sound.voiceEnabled).toBe(true)
  })

  it('resets history while keeping profile preferences and weight entries', async () => {
    await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'seek', cursor: 5 })
    store.updateSettings({ ...store.getSnapshot().settings, characterPackId: 'engineer', sound: { enabled: false, volume: 0.2, packId: 'default', voiceEnabled: true } })
    store.updateProgress({ ...store.getSnapshot().progress, characterBuild: 'stocky' })
    store.addWeightEntry({ weightKg: 75 })
    const before = store.getSnapshot()
    await command({ action: 'reset-history' })
    expect(store.getSnapshot()).toMatchObject({ sessions: [], settings: before.settings, weights: before.weights,
      progress: { characterStage: 0, characterBuild: 'stocky', streak: { current: 0, max: 0 } } })
  })
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
  it('opens the single laboratory dashboard instead of spawning another process', async () => {
    mocks.enabled = true
    await controller.launchLaboratory()
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(mocks.createDashboard).toHaveBeenCalledWith(expect.objectContaining({
      tab: 'debug', laboratory: true, onClosed: expect.any(Function)
    }))
  })
  it('closes the real dashboard while the spawned laboratory runs and restores it on exit', async () => {
    mocks.enabled = false
    const parent = { close: vi.fn(() => { mocks.dashboard = null }), isDestroyed: () => false, isVisible: () => true }
    mocks.dashboard = parent
    mocks.spawn.mockImplementation(() => {
      const child = new EventEmitter()
      mocks.spawnChild = child
      queueMicrotask(() => child.emit('spawn'))
      return child
    })
    await controller.launchLaboratory()
    expect(parent.close).toHaveBeenCalledOnce()
    expect(mocks.createDashboard).not.toHaveBeenCalled()
    mocks.spawnChild!.emit('exit')
    expect(mocks.createDashboard).toHaveBeenCalledOnce()
  })
  it('keeps the real dashboard when the laboratory cannot start', async () => {
    mocks.enabled = false
    const parent = { close: vi.fn(), isDestroyed: () => false, isVisible: () => true }
    mocks.dashboard = parent
    mocks.spawn.mockImplementation(() => {
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('error', new Error('spawn failed')))
      return child
    })
    await expect(controller.launchLaboratory()).rejects.toThrow('spawn failed')
    expect(parent.close).not.toHaveBeenCalled()
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
  it('opens a real native event instead of inserting its final snapshot, and freezes while paused', async () => {
    await command({ action: 'scenario', id: 'return' })
    await command({ action: 'play', delayMs: 500 })
    vi.advanceTimersByTime(1000)
    expect(controller.getLabState()).toMatchObject({ cursor: 1, playing: true, activePopup: true, playback: { phase: 'reminder' } })
    expect(store.getSnapshot().sessions).toEqual([])
    await command({ action: 'pause' })
    vi.advanceTimersByTime(600000)
    expect(controller.getLabState()).toMatchObject({ cursor: 1, playing: false, activePopup: true })
    expect(store.getSnapshot().sessions).toEqual([])
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
    expect(JSON.parse(readFileSync(join(mocks.dir, 'data', 'laboratory-run.json'), 'utf8')).data.plan.version).toBe(2)
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
  it.each(LAB_SCENARIOS)('replays $id through real loop outcomes, without inserting future history', async ({ id }) => {
    const initial = await command({ action: 'scenario', id })
    const expected = labSummary(initial.plan!, initial.plan!.events.length - 1)
    let hold: ReturnType<typeof setTimeout> | undefined
    mocks.driver.mockImplementation((_channel: string, request: LabDriverCommand) => {
      if (request.action === 'cancel') { clearTimeout(hold); return }
      if (request.action === 'start') controller.acknowledgeLabDriver({ ...request, kind: 'applied' })
      if (['done', 'skipped', 'snoozed', 'hold'].includes(request.action)) {
        const resolve = () => {
          const active = loop.getActivePopup()
          if (!active || active.sessionId !== request.sessionId) return
          const status = request.action === 'hold' ? 'done' : request.action as 'done' | 'skipped' | 'snoozed'
          expect(loop.handleSessionResult({ sessionId: active.sessionId, exerciseId: active.exercise.id, status })).toEqual({ saved: true })
          setTimeout(() => { mocks.popup = false }, 1000)
        }
        if (request.action === 'hold') hold = setTimeout(resolve, 1500)
        else resolve()
      }
    })
    await command({ action: 'play', delayMs: 500 })
    for (let step = 0; step < 6000 && controller.getLabState().playing; step++) {
      const state = controller.getLabState()
      if (state.playback?.phase === 'reminder') {
        controller.acknowledgeLabDriver({ kind: 'ready', sessionId: state.playback.sessionId! })
      }
      vi.advanceTimersByTime(500)
    }
    expect(controller.getLabState()).toMatchObject({ playing: false, playback: { phase: 'finished' } })
    const actual = store.getSnapshot()
    expect(actual.sessions.map(session => session.status)).toEqual(initial.plan!.events.flatMap(event => event.session ? [event.session.status] : []))
    expect(actual.progress.characterStage).toBe(expected.character.stage)
    expect(actual.progress.characterBranch).toBe(expected.character.branch)
    expect(actual.progress.streak).toEqual({ current: expected.streak.current, max: expected.streak.max })
    await command({ action: 'save' })
  })
  it('keeps character preferences across stories and seeks, preserving the original future of a manual branch', async () => {
    store.updateSettings({ ...store.getSnapshot().settings, characterPackId: 'engineer', themeId: 'night-ops' })
    store.updateProgress({ ...store.getSnapshot().progress, characterBuild: 'stocky' })
    const initial = await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'seek', cursor: 5 })
    expect(store.getSnapshot()).toMatchObject({ settings: { characterPackId: 'engineer' }, progress: { characterBuild: 'stocky' } })
    await command({ action: 'popup', preset: 'soft' })
    const active = loop.getActivePopup()!
    loop.handleSessionResult({ sessionId: active.sessionId, exerciseId: active.exercise.id, status: 'skipped' })
    expect(controller.getLabState().hasOriginal).toBe(true)
    await command({ action: 'save' })
    await command({ action: 'reset' })
    await command({ action: 'restore' })
    expect(controller.getLabState().hasOriginal).toBe(true)
    await command({ action: 'original' })
    expect(controller.getLabState().plan!.events).toEqual(initial.plan!.events)
  })
  it('waits indefinitely for an interactive choice without executing the planned outcome or missed deadline', async () => {
    await command({ action: 'scenario', id: 'growth' })
    await command({ action: 'mode', mode: 'interactive' })
    await command({ action: 'seek', cursor: 1 })
    mocks.driver.mockImplementation((_channel: string, request: LabDriverCommand) => {
      if (request.action === 'start') controller.acknowledgeLabDriver({ ...request, kind: 'applied' })
    })
    await command({ action: 'play', delayMs: 500 })
    vi.advanceTimersByTime(500)
    const sessionId = controller.getLabState().playback!.sessionId!
    controller.acknowledgeLabDriver({ kind: 'ready', sessionId })
    vi.advanceTimersByTime(10000)
    expect(controller.getLabState().playback).toMatchObject({ phase: 'choice', waiting: true, mode: 'interactive' })
    vi.advanceTimersByTime(600000)
    expect(store.getSnapshot().sessions).toEqual([])
    expect(mocks.driver.mock.calls.map(([, request]) => request.action)).not.toContain('done')
    controller.acknowledgeLabDriver({ kind: 'manual', sessionId })
    const active = loop.getActivePopup()!
    expect(loop.handleSessionResult({ sessionId, exerciseId: active.exercise.id, status: 'skipped' })).toEqual({ saved: true })
    expect(controller.getLabState()).toMatchObject({ hasOriginal: true, playback: { phase: 'saved' } })
    expect(store.getSnapshot().sessions).toHaveLength(1)
  })
  it('freezes an accelerated unanswered-popup deadline until replay resumes', async () => {
    const initial = await command({ action: 'scenario', id: 'recovery' })
    const missed = initial.plan!.events.findIndex(event => event.session?.status === 'missed')
    await command({ action: 'seek', cursor: missed - 1 })
    const count = store.getSnapshot().sessions.length
    await command({ action: 'play', delayMs: 500 })
    vi.advanceTimersByTime(500)
    const sessionId = controller.getLabState().playback!.sessionId!
    controller.acknowledgeLabDriver({ kind: 'ready', sessionId })
    vi.advanceTimersByTime(1000)
    await command({ action: 'pause' })
    const frozen = store.getSnapshot().laboratory!.at
    vi.advanceTimersByTime(600000)
    expect(store.getSnapshot().laboratory!.at).toBe(frozen)
    expect(store.getSnapshot().sessions).toHaveLength(count)
    expect(loop.getActivePopup()?.sessionId).toBe(sessionId)
    await command({ action: 'play', delayMs: 500 })
    vi.advanceTimersByTime(1500)
    expect(store.getSnapshot().sessions).toHaveLength(count + 1)
    expect(store.getSnapshot().sessions.at(-1)!.status).toBe('missed')
    expect(['saved', 'reaction', 'closing']).toContain(controller.getLabState().playback?.phase)
  })
  it.each([{ action: 'seek', cursor: NaN }, { action: 'advance', seconds: Infinity }, { action: 'idle', seconds: -1 },
    { action: 'play', delayMs: 0 }, { action: 'step', unit: 'bad', direction: 1 }] as unknown as LabCommand[])(
    'rejects invalid command %j', async value => {
      await command({ action: 'scenario', id: 'growth' })
      await expect(command(value)).rejects.toThrow()
      expect(store.getSnapshot().sessions).toEqual([])
    })
})
