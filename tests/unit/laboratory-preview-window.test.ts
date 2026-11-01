// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeLabPreviewWindow, openLabPreviewWindow } from '../../electron/main/windows/laboratory-preview'

const state = vi.hoisted(() => ({ options: [] as Record<string, unknown>[], handlers: new Map<string, () => void>(),
  show: vi.fn(), focus: vi.fn(), loadFile: vi.fn(), destroyed: false }))
vi.mock('electron', () => ({ screen: { getPrimaryDisplay: () => ({ workArea: { x: 1920, y: -200, width: 1280, height: 720 } }) },
  BrowserWindow: class {
    constructor(options: Record<string, unknown>) { state.options.push(options) }
    once(event: string, callback: () => void) { state.handlers.set(event, callback) }
    isDestroyed() { return state.destroyed }
    show() { state.show() }
    focus() { state.focus() }
    loadFile(...args: unknown[]) { state.loadFile(...args) }
    close() { state.destroyed = true; state.handlers.get('closed')?.() }
  }
}))
beforeEach(() => { state.options = []; state.handlers.clear(); state.destroyed = false; state.show.mockClear(); state.focus.mockClear(); state.loadFile.mockClear(); vi.stubEnv('ELECTRON_RENDERER_URL', '') })
afterEach(() => { closeLabPreviewWindow(); vi.unstubAllEnvs() })

describe('independent native preview window', () => {
  it('uses popup geometry inside the display work area, reuses its window and reports closure', () => {
    const closed = vi.fn()
    openLabPreviewWindow(closed)
    expect(state.options[0]).toMatchObject({ width: 320, height: 360, x: 2864, y: 144, frame: false })
    expect(state.loadFile.mock.calls[0]![1]).toEqual({ hash: '/laboratory-preview' })
    state.handlers.get('ready-to-show')?.()
    expect(state.show).toHaveBeenCalledOnce()
    openLabPreviewWindow(closed)
    expect(state.options).toHaveLength(1)
    expect(state.focus).toHaveBeenCalledOnce()
    closeLabPreviewWindow()
    expect(closed).toHaveBeenCalledOnce()
  })
})
