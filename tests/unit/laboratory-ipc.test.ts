// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels } from '@shared/types/events'
import { registerDebugIpc } from '../../electron/main/ipc/debug'

const state = vi.hoisted(() => ({
  enabled: true, packaged: false, popup: {}, acknowledge: vi.fn(),
  handlers: new Map<string, (...args: unknown[]) => unknown>()
}))
vi.mock('electron', () => ({ app: { get isPackaged() { return state.packaged } },
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => state.handlers.set(channel, handler) } }))
vi.mock('../../electron/main/lab-environment', () => ({ isLabProcess: () => state.enabled }))
vi.mock('../../electron/main/laboratory', () => ({ acknowledgeLabDriver: state.acknowledge,
  executeLabCommand: vi.fn(), getLabState: vi.fn(), launchLaboratory: vi.fn() }))
vi.mock('../../electron/main/windows/popup', () => ({ getPopupWindow: () => ({ webContents: state.popup }) }))
vi.mock('../../electron/main/broadcast', () => ({ broadcastToWindows: vi.fn() }))
vi.mock('../../electron/main/persistence', () => ({ applyDebugState: vi.fn() }))
vi.mock('../../electron/main/trigger-loop', () => ({ syncLoopFromSettings: vi.fn() }))

beforeEach(() => { state.enabled = true; state.packaged = false; state.handlers.clear(); state.acknowledge.mockClear() })
describe('native action driver IPC boundary', () => {
  it('accepts acknowledgements only from the actual active popup WebContents', () => {
    registerDebugIpc()
    const handler = state.handlers.get(IpcChannels.LabDriverAck)!
    const ack = { kind: 'ready', sessionId: 'session-1' }
    expect(() => handler({ sender: {} }, ack)).toThrow('active laboratory popup')
    expect(state.acknowledge).not.toHaveBeenCalled()
    handler({ sender: state.popup }, ack)
    expect(state.acknowledge).toHaveBeenCalledWith(ack)
  })
  it('does not register the driver in a normal or packaged process', () => {
    state.enabled = false
    registerDebugIpc()
    expect(state.handlers.has(IpcChannels.LabDriverAck)).toBe(false)
    state.handlers.clear(); state.packaged = true; state.enabled = true
    registerDebugIpc()
    expect(state.handlers.size).toBe(0)
  })
})
