// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  options: [] as Record<string, unknown>[],
  handlers: new Map<string, () => void>(),
  sent: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  loadFile: vi.fn(),
  loadURL: vi.fn(),
  title: '',
  destroyed: false
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getName: () => 'Body Debugger',
    getAppPath: () => 'E:/Electron/body_debugger'
  },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1280, height: 900 } }) },
  BrowserWindow: class {
    webContents = { send: (...args: unknown[]) => state.sent(...args) }
    constructor(options: Record<string, unknown>) { state.options.push(options) }
    once(event: string, callback: () => void) { state.handlers.set(event, callback) }
    on(event: string, callback: () => void) { state.handlers.set(event, callback) }
    isDestroyed() { return state.destroyed }
    show() { state.show() }
    focus() { state.focus() }
    loadFile(...args: unknown[]) { state.loadFile(...args) }
    loadURL(...args: unknown[]) { state.loadURL(...args) }
    setMenuBarVisibility() {}
    setTitle(title: string) { state.title = title }
    close() { state.destroyed = true; state.handlers.get('closed')?.() }
  }
}))

beforeEach(() => {
  vi.resetModules()
  state.options = []
  state.handlers.clear()
  state.destroyed = false
  state.title = ''
  state.show.mockClear(); state.focus.mockClear(); state.loadFile.mockClear(); state.loadURL.mockClear(); state.sent.mockClear()
  vi.stubEnv('ELECTRON_RENDERER_URL', '')
})
afterEach(() => { vi.unstubAllEnvs() })

describe('dashboard window', () => {
  it('opens the laboratory as one wide window on the laboratory tab', async () => {
    const { createDashboardWindow } = await import('../../electron/main/windows/dashboard')
    createDashboardWindow({ tab: 'debug', laboratory: true })
    expect(state.options[0]).toMatchObject({
      width: 1160, minWidth: 700, title: 'Body Debugger · Лаборатория'
    })
    expect(state.loadFile.mock.calls[0]![1]).toEqual({ hash: '/dashboard?tab=debug' })
    state.handlers.get('ready-to-show')?.()
    expect(state.show).toHaveBeenCalledOnce()
  })

  it('keeps the normal dashboard geometry and opens the requested tab', async () => {
    const { createDashboardWindow } = await import('../../electron/main/windows/dashboard')
    createDashboardWindow({ tab: 'settings' })
    expect(state.options[0]).toMatchObject({ width: 960, title: 'Body Debugger' })
    expect(state.loadFile.mock.calls[0]![1]).toEqual({ hash: '/dashboard?tab=settings' })
  })

  it('reuses the window, focuses it and sends a navigation payload', async () => {
    const { createDashboardWindow } = await import('../../electron/main/windows/dashboard')
    createDashboardWindow({ tab: 'debug', laboratory: true })
    createDashboardWindow({ tab: 'settings' })
    expect(state.options).toHaveLength(1)
    expect(state.focus).toHaveBeenCalledOnce()
    expect(state.sent).toHaveBeenCalledWith('window:navigate-dashboard', { tab: 'settings' })
  })

  it('reports closure once and lets the caller recreate the window', async () => {
    const onClosed = vi.fn()
    const { createDashboardWindow, getDashboardWindow } = await import('../../electron/main/windows/dashboard')
    const window = createDashboardWindow({ laboratory: true, onClosed })
    window.close()
    expect(onClosed).toHaveBeenCalledOnce()
    expect(getDashboardWindow()).toBeNull()
  })
})
