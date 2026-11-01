// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

const state = vi.hoisted(() => ({
  ipcHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  ipcListeners: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  child: null as (EventEmitter & { send: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }) | null,
  spawn: vi.fn(),
  labHostSend: vi.fn()
}))

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => 'E:/Electron/body_debugger' },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => state.ipcHandlers.set(channel, handler),
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => state.ipcListeners.set(channel, listener)
  }
}))
vi.mock('node:child_process', () => ({ spawn: state.spawn }))
vi.mock('../../electron/main/lab-environment', () => ({
  LAB_ARGUMENT: '--body-debugger-lab',
  LAB_HEADLESS_ARGUMENT: '--body-debugger-lab-headless'
}))
vi.mock('../../electron/main/playback-coordinator', () => ({
  beginPlayback: vi.fn(),
  endPlayback: vi.fn(),
  registerPlaybackStopper: vi.fn()
}))

const labHost = {
  getType: () => 'window',
  isDestroyed: () => false,
  once: () => undefined,
  send: state.labHostSend
}

function childProcess(): EventEmitter & { send: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> } {
  const child = new EventEmitter() as EventEmitter & { send: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }
  child.send = vi.fn()
  child.kill = vi.fn()
  state.child = child
  return child
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('ELECTRON_RENDERER_URL', 'file:///app/index.html')
  state.ipcHandlers.clear(); state.ipcListeners.clear()
  state.child = null; state.spawn.mockReset(); state.labHostSend.mockClear()
  state.spawn.mockImplementation(() => childProcess())
})
afterEach(() => { vi.unstubAllEnvs() })

describe('laboratory engine bridge', () => {
  it('spawns a headless child, forwards requests and relays lab-changed events', async () => {
    const engine = await import('../../electron/main/lab-engine')
    engine.registerLabEngineIpc()
    const register = state.ipcListeners.get('lab:view-register')!
    register({ sender: labHost })
    expect(state.spawn).toHaveBeenCalledOnce()
    const [, args, options] = state.spawn.mock.calls[0]!
    expect(args).toEqual(['E:/Electron/body_debugger', '--body-debugger-lab', '--body-debugger-lab-headless'])
    expect(options).toMatchObject({ stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    expect(options.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE')

    state.child!.emit('message', { type: 'ready' })
    const request = state.ipcHandlers.get('lab:bridge-request')!({ sender: labHost }, { method: 'data:get-snapshot', payload: {} })
    await Promise.resolve()
    const sent = state.child!.send.mock.calls[0]![0]
    expect(sent.request).toMatchObject({ method: 'data:get-snapshot', payload: {} })
    state.child!.emit('message', { type: 'response', response: { id: sent.request.id, ok: true, value: { ok: 1 } } })
    await expect(request).resolves.toEqual({ ok: 1 })

    state.child!.emit('message', { type: 'event', channel: 'lab:changed', payload: { cursor: 2, playing: false } })
    expect(state.labHostSend).toHaveBeenCalledWith('lab:changed', { cursor: 2, playing: false })
  })

  it('rejects bridge calls from any other renderer', async () => {
    const engine = await import('../../electron/main/lab-engine')
    engine.registerLabEngineIpc()
    const handler = state.ipcHandlers.get('lab:bridge-request')!
    await expect(handler({ sender: { getType: () => 'window' } }, { method: 'data:get-snapshot' }))
      .rejects.toThrow('registered lab host')
  })

  it('does not forward DataUpdated events to the dashboard host', async () => {
    const engine = await import('../../electron/main/lab-engine')
    engine.registerLabEngineIpc()
    state.ipcListeners.get('lab:view-register')!({ sender: labHost })
    state.child!.emit('message', { type: 'ready' })
    state.child!.emit('message', { type: 'event', channel: 'data:updated', payload: { sessions: [] } })
    expect(state.labHostSend).not.toHaveBeenCalled()
  })
})
