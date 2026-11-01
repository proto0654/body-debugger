// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import {
  getLaboratoryUserDataPath,
  getUserDataPath,
  isLabHeadless,
  isLabProcess,
  LAB_ARGUMENT,
  LAB_HEADLESS_ARGUMENT
} from '../../electron/main/lab-environment'

const app = vi.hoisted(() => ({
  isPackaged: false,
  getAppPath: () => join('E:', 'Electron', 'body_debugger'),
  getPath: (name: string) => name === 'userData' ? join('C:', 'Users', 'tester', 'AppData', 'Roaming', 'Body Debugger') : ''
}))
vi.mock('electron', () => ({ app }))
const originalArgv = [...process.argv]
afterEach(() => { process.argv = [...originalArgv]; app.isPackaged = false })

describe('laboratory profile boundary', () => {
  it('keeps normal data at the established profile path', () => {
    process.argv = ['electron', '.']
    expect(isLabProcess()).toBe(false)
    expect(isLabHeadless()).toBe(false)
    expect(getUserDataPath()).toBe(join(app.getAppPath(), '.userdata'))
  })
  it('routes every unpackaged laboratory subsystem into a separate profile on the project drive', () => {
    process.argv = ['electron', '.', LAB_ARGUMENT]
    expect(isLabProcess()).toBe(true)
    expect(isLabHeadless()).toBe(false)
    expect(getUserDataPath()).toBe(join(app.getAppPath(), '.userdata', 'laboratory'))
    expect(getLaboratoryUserDataPath()).toBe(join(app.getAppPath(), '.userdata', 'laboratory'))
  })
  it('marks the playground engine launch as headless', () => {
    process.argv = ['electron', '.', LAB_ARGUMENT, LAB_HEADLESS_ARGUMENT]
    expect(isLabProcess()).toBe(true)
    expect(isLabHeadless()).toBe(true)
  })
  it('keeps the packaged laboratory in a sandbox below the OS profile', () => {
    app.isPackaged = true
    process.argv = ['Body Debugger.exe', LAB_ARGUMENT, LAB_HEADLESS_ARGUMENT]
    expect(isLabProcess()).toBe(true)
    expect(getUserDataPath()).toBe(join(app.getPath('userData'), 'laboratory'))
    expect(getLaboratoryUserDataPath()).toBe(join(app.getPath('userData'), 'laboratory'))
  })
  it('keeps the packaged dashboard at the OS profile', () => {
    app.isPackaged = true
    process.argv = ['Body Debugger.exe']
    expect(isLabProcess()).toBe(false)
    expect(getUserDataPath()).toBe(app.getPath('userData'))
  })
})
