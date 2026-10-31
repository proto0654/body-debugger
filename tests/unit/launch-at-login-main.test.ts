// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  packaged: true,
  openAtLogin: false,
  willLaunch: false,
  calls: [] as Record<string, unknown>[]
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() { return state.packaged },
    getName: () => 'Body Debugger',
    getLoginItemSettings: vi.fn(() => ({
      openAtLogin: state.openAtLogin,
      executableWillLaunchAtLogin: state.willLaunch
    })),
    setLoginItemSettings: vi.fn((settings: Record<string, unknown>) => {
      state.calls.push(settings)
      state.openAtLogin = settings.openAtLogin === true
      state.willLaunch = settings.openAtLogin === true
    })
  }
}))

describe.skipIf(process.platform !== 'win32')('launch-at-login main integration', () => {
  beforeEach(() => {
    state.packaged = true
    state.openAtLogin = false
    state.willLaunch = false
    state.calls = []
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reads the hidden login item and reports Task Manager state', async () => {
    state.openAtLogin = true
    state.willLaunch = false
    const { getLaunchAtLoginState } = await import('../../electron/main/launch-at-login')

    expect(getLaunchAtLoginState()).toEqual({ supported: true, enabled: true, willLaunch: false })
    expect(state.calls).toHaveLength(0)
  })

  it('writes the executable, hidden argument and product name', async () => {
    const { setLaunchAtLogin } = await import('../../electron/main/launch-at-login')

    expect(setLaunchAtLogin(true)).toMatchObject({ supported: true, enabled: true })
    expect(state.calls[0]).toMatchObject({
      openAtLogin: true,
      enabled: true,
      args: ['--hidden'],
      name: 'Body Debugger'
    })
  })

  it('leaves an unpackaged dev run unsupported', async () => {
    state.packaged = false
    const { getLaunchAtLoginState, setLaunchAtLogin } = await import('../../electron/main/launch-at-login')

    expect(getLaunchAtLoginState()).toEqual({ supported: false, enabled: false, willLaunch: false })
    expect(setLaunchAtLogin(true)).toEqual({ supported: false, enabled: false, willLaunch: false })
    expect(state.calls).toHaveLength(0)
  })
})
