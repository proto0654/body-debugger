import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import SystemPanel from '@/components/settings/SystemPanel.vue'
import type { LaunchAtLoginState } from '@shared/domain/launch-at-login'

const unsupported: LaunchAtLoginState = { supported: false, enabled: false, willLaunch: false }
const disabled: LaunchAtLoginState = { supported: true, enabled: false, willLaunch: false }
const enabled: LaunchAtLoginState = { supported: true, enabled: true, willLaunch: true }
const disabledByOs: LaunchAtLoginState = { supported: true, enabled: true, willLaunch: false }

let launchState: LaunchAtLoginState = disabled

const getLaunchAtLogin = vi.fn(async (): Promise<LaunchAtLoginState> => launchState)
const setLaunchAtLogin = vi.fn(async (next: boolean): Promise<LaunchAtLoginState> => ({
  supported: true,
  enabled: next,
  willLaunch: next
}))

let wrapper: VueWrapper | null = null

async function settle(): Promise<void> {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  launchState = disabled
  getLaunchAtLogin.mockClear()
  setLaunchAtLogin.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { getLaunchAtLogin, setLaunchAtLogin }
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SystemPanel', () => {
  it('explains that autostart needs an installed Windows build', async () => {
    launchState = unsupported
    wrapper = mount(SystemPanel)
    await settle()
    expect(wrapper.get('[data-testid="launch-at-login-toggle"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="launch-at-login-toggle"]').text()).toBe('Недоступно')
    expect(wrapper.find('[data-testid="launch-at-login-unsupported"]').exists()).toBe(true)
  })

  it('turns autostart on and reflects the OS result', async () => {
    wrapper = mount(SystemPanel)
    await settle()
    expect(wrapper.get('[data-testid="launch-at-login-toggle"]').text()).toBe('Выкл')

    await wrapper.get('[data-testid="launch-at-login-toggle"]').trigger('click')
    await settle()
    expect(setLaunchAtLogin).toHaveBeenCalledWith(true)
    expect(wrapper.get('[data-testid="launch-at-login-toggle"]').text()).toBe('Вкл')
  })

  it('warns when Windows disabled the entry in Task Manager', async () => {
    launchState = disabledByOs
    wrapper = mount(SystemPanel)
    await settle()
    expect(wrapper.find('[data-testid="launch-at-login-disabled-by-os"]').exists()).toBe(true)
  })

  it('reports a failed save and keeps the previous state', async () => {
    setLaunchAtLogin.mockRejectedValueOnce(new Error('registry denied'))
    wrapper = mount(SystemPanel)
    await settle()
    await wrapper.get('[data-testid="launch-at-login-toggle"]').trigger('click')
    await settle()
    expect(wrapper.get('[data-testid="launch-at-login-error"]').text()).toContain('Не удалось изменить')
    expect(wrapper.get('[data-testid="launch-at-login-toggle"]').text()).toBe('Выкл')
  })

  it('reports a missing preload bridge instead of crashing', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    wrapper = mount(SystemPanel)
    await settle()
    expect(wrapper.get('[data-testid="launch-at-login-error"]').text()).toContain('Не удалось прочитать')
  })
})
