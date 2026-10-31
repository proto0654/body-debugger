import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import AboutPanel from '@/components/settings/AboutPanel.vue'
import type { AppInfoPayload, UpdateStatePayload } from '@shared/types/events'

const info: AppInfoPayload = {
  version: '0.2.0',
  buildCommit: 'a1b2c3d',
  buildDate: '2026-11-02',
  packaged: true,
  channel: 'prod',
  platform: 'win32',
  dataPath: 'C:\\Users\\tester\\AppData\\Roaming\\Body Debugger',
  logDir: 'C:\\Users\\tester\\AppData\\Roaming\\Body Debugger\\logs'
}

const idleUpdate: UpdateStatePayload = {
  status: 'idle',
  currentVersion: '0.2.0',
  availableVersion: null,
  progressPercent: null,
  checkedAt: null,
  error: null
}

let updateState: UpdateStatePayload = idleUpdate
let updateListener: ((state: UpdateStatePayload) => void) | null = null

const getAppInfo = vi.fn(async (): Promise<AppInfoPayload> => info)
const openLogs = vi.fn(async () => true)
const getUpdateState = vi.fn(async (): Promise<UpdateStatePayload> => updateState)
const checkForUpdates = vi.fn(async (): Promise<UpdateStatePayload> => updateState)
const installUpdate = vi.fn(async () => ({ started: true, reason: null as 'popup-open' | 'not-ready' | null }))
const onUpdateState = vi.fn((handler: (state: UpdateStatePayload) => void) => {
  updateListener = handler
  return () => { updateListener = null }
})

let wrapper: VueWrapper | null = null

async function settle(): Promise<void> {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
  await nextTick()
}

function findButton(label: string) {
  const button = wrapper!.findAll('button').find(candidate => candidate.text() === label)
  if (!button) throw new Error(`button "${label}" not found`)
  return button
}

beforeEach(() => {
  updateState = idleUpdate
  updateListener = null
  getAppInfo.mockClear()
  openLogs.mockClear()
  getUpdateState.mockClear()
  checkForUpdates.mockClear()
  installUpdate.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { getAppInfo, openLogs, getUpdateState, checkForUpdates, installUpdate, onUpdateState }
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AboutPanel', () => {
  it('shows the version, build stamp and profile path a tester must report', async () => {
    wrapper = mount(AboutPanel)
    await settle()
    expect(wrapper.get('[data-testid="about-version"]').text()).toBe('0.2.0')
    expect(wrapper.get('[data-testid="about-build"]').text()).toBe('a1b2c3d · 2026-11-02')
    expect(wrapper.get('[data-testid="about-mode"]').text()).toBe('установленная')
    expect(wrapper.get('[data-testid="about-channel"]').text()).toBe('стабильный')
    expect(wrapper.get('[data-testid="about-data-path"]').text()).toBe(info.dataPath)
  })

  it('marks a development run so a dev build is never mistaken for a release', async () => {
    getAppInfo.mockResolvedValueOnce({ ...info, packaged: false, buildCommit: 'nogit', channel: 'dev' })
    wrapper = mount(AboutPanel)
    await settle()
    expect(wrapper.get('[data-testid="about-mode"]').text()).toBe('разработка')
    expect(wrapper.get('[data-testid="about-channel"]').text()).toBe('тестовый (dev)')
  })

  it('opens the log directory and reports a failed attempt', async () => {
    wrapper = mount(AboutPanel)
    await settle()
    await findButton('Открыть папку с логами').trigger('click')
    expect(openLogs).toHaveBeenCalledTimes(1)

    openLogs.mockResolvedValueOnce(false)
    await findButton('Открыть папку с логами').trigger('click')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toBe('Не удалось открыть папку с логами.')
  })

  it('stays inert when the preload bridge is unavailable', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    wrapper = mount(AboutPanel)
    await settle()
    expect(wrapper.get('[data-testid="about-version"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="about-build"]').text()).toBe('—')
  })

  it('describes a downloaded update and restarts into it', async () => {
    updateState = { ...idleUpdate, status: 'ready', availableVersion: '0.2.1', progressPercent: 100 }
    wrapper = mount(AboutPanel)
    await settle()
    expect(wrapper.get('[data-testid="update-status"]').text()).toContain('Версия 0.2.1 готова')
    await wrapper.get('[data-testid="update-install"]').trigger('click')
    await settle()
    expect(installUpdate).toHaveBeenCalledTimes(1)
  })

  it('refuses to interrupt an open popup and explains when the update will apply', async () => {
    updateState = { ...idleUpdate, status: 'ready', availableVersion: '0.2.1', progressPercent: 100 }
    installUpdate.mockResolvedValueOnce({ started: false, reason: 'popup-open' })
    wrapper = mount(AboutPanel)
    await settle()
    await wrapper.get('[data-testid="update-install"]').trigger('click')
    await settle()
    expect(wrapper.get('[role="status"]').text()).toContain('Открыт попап с упражнением')
  })

  it('shows download progress and follows pushed state changes', async () => {
    updateState = { ...idleUpdate, status: 'downloading', availableVersion: '0.2.1', progressPercent: 42 }
    wrapper = mount(AboutPanel)
    await settle()
    expect(wrapper.get('[data-testid="update-status"]').text()).toContain('42%')

    updateListener?.({ ...idleUpdate, status: 'current', checkedAt: '2026-11-02T10:00:00.000Z' })
    await nextTick()
    expect(wrapper.get('[data-testid="update-status"]').text()).toContain('последняя версия')
  })

  it('disables the check button when updates are off, while a check runs, or when a restart is ready', async () => {
    updateState = { ...idleUpdate, status: 'disabled' }
    wrapper = mount(AboutPanel)
    await settle()
    expect(findButton('Проверить обновления').attributes('disabled')).toBeDefined()

    wrapper.unmount()
    updateState = { ...idleUpdate, status: 'checking' }
    wrapper = mount(AboutPanel)
    await settle()
    expect(findButton('Проверить обновления').attributes('disabled')).toBeDefined()

    wrapper.unmount()
    updateState = { ...idleUpdate, status: 'ready', availableVersion: '0.2.1', progressPercent: 100 }
    wrapper = mount(AboutPanel)
    await settle()
    expect(findButton('Проверить обновления').attributes('disabled')).toBeDefined()
  })
})
