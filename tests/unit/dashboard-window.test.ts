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
    setTitle() {}
    close() { state.destroyed = true; state.handlers.get('closed')?.() }
  }
}))
vi.mock('../../electron/main/lab-engine', () => ({
  ensureLabEngine: vi.fn(async () => undefined)
}))

beforeEach(() => {
  vi.resetModules()
  state.options = []
  state.handlers.clear()
  state.destroyed = false
  state.show.mockClear(); state.focus.mockClear(); state.loadFile.mockClear(); state.loadURL.mockClear(); state.sent.mockClear()
  vi.stubEnv('ELECTRON_RENDERER_URL', '')
})
afterEach(() => { vi.unstubAllEnvs() })

describe('dashboard window', () => {
  it('opens the normal dashboard without a webview tag', async () => {
    const { createDashboardWindow } = await import('../../electron/main/windows/dashboard')
    createDashboardWindow()
    expect(state.options[0]).toMatchObject({ width: 960, title: 'Body Debugger' })
    expect(state.options[0]!.webPreferences).toMatchObject({ contextIsolation: true })
    expect((state.options[0]!.webPreferences as { webviewTag?: boolean }).webviewTag).toBeUndefined()
    expect(state.loadFile.mock.calls[0]![1]).toEqual({ hash: '/dashboard' })
    state.handlers.get('ready-to-show')?.()
    expect(state.show).toHaveBeenCalledOnce()
  })

  it('opens the requested settings tab', async () => {
    const { createDashboardWindow } = await import('../../electron/main/windows/dashboard')
    createDashboardWindow({ tab: 'settings' })
    expect(state.loadFile.mock.calls[0]![1]).toEqual({ hash: '/dashboard?tab=settings' })
  })

  it('reuses the window, focuses it and sends a navigation payload', async () => {
    const { createDashboardWindow } = await import('../../electron/main/windows/dashboard')
    createDashboardWindow()
    createDashboardWindow({ tab: 'settings' })
    expect(state.options).toHaveLength(1)
    expect(state.focus).toHaveBeenCalledOnce()
    expect(state.sent).toHaveBeenCalledWith('window:navigate-dashboard', { tab: 'settings' })
  })

  it('reports closure and lets the caller recreate the window', async () => {
    const { createDashboardWindow, getDashboardWindow } = await import('../../electron/main/windows/dashboard')
    const window = createDashboardWindow()
    window.close()
    expect(getDashboardWindow()).toBeNull()
  })
})
