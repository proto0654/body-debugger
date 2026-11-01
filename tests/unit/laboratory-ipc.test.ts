// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels } from '@shared/types/events'
import { registerDebugIpc } from '../../electron/main/ipc/debug'

const state = vi.hoisted(() => ({
  enabled: true, popup: {}, acknowledge: vi.fn(),
  handlers: new Map<string, (...args: unknown[]) => unknown>()
}))
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => state.handlers.set(channel, handler) }
}))
vi.mock('../../electron/main/lab-environment', () => ({
  isLabProcess: () => state.enabled
}))
vi.mock('../../electron/main/laboratory', () => ({
  acknowledgeLabDriver: state.acknowledge,
  enqueueLabCommand: vi.fn(),
  getLabState: vi.fn()
}))
vi.mock('../../electron/main/windows/popup', () => ({ getPopupWindow: () => ({ webContents: state.popup }) }))

beforeEach(() => {
  state.enabled = true
  state.handlers.clear(); state.acknowledge.mockClear()
})

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
  it('registers the lab renderer handlers only in the laboratory process', () => {
    state.enabled = false
    registerDebugIpc()
    expect(state.handlers.size).toBe(0)

    state.handlers.clear()
    state.enabled = true
    registerDebugIpc()
    expect(state.handlers.has(IpcChannels.LabGetState)).toBe(true)
    expect(state.handlers.has(IpcChannels.LabCommand)).toBe(true)
    expect(state.handlers.has(IpcChannels.LabDriverAck)).toBe(true)
  })
})
