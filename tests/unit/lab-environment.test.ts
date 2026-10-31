// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { getUserDataPath, isLabProcess, LAB_ARGUMENT } from '../../electron/main/lab-environment'

const app = vi.hoisted(() => ({
  isPackaged: false,
  getAppPath: () => join('E:', 'Electron', 'body_debugger'),
  getPath: (name: string) => name === 'userData' ? join('C:', 'Users', 'tester', 'AppData', 'Roaming', 'body-debugger') : ''
}))
vi.mock('electron', () => ({ app }))
const originalArgv = [...process.argv]
afterEach(() => { process.argv = [...originalArgv]; app.isPackaged = false })

describe('laboratory profile boundary', () => {
  it('keeps normal data at the established profile path', () => {
    process.argv = ['electron', '.']
    expect(isLabProcess()).toBe(false)
    expect(getUserDataPath()).toBe(join(app.getAppPath(), '.userdata'))
  })
  it('routes every laboratory subsystem into a separate profile on the project drive', () => {
    process.argv = ['electron', '.', LAB_ARGUMENT]
    expect(isLabProcess()).toBe(true)
    expect(getUserDataPath()).toBe(join(app.getAppPath(), '.userdata', 'laboratory'))
  })
  it('cannot enable laboratory privileges in a packaged application', () => {
    app.isPackaged = true
    process.argv = ['electron', '.', LAB_ARGUMENT]
    expect(isLabProcess()).toBe(false)
  })
})

describe('packaged application profile', () => {
  it('writes to the OS profile instead of the read-only app.asar directory', () => {
    app.isPackaged = true
    process.argv = ['electron', '.']
    expect(getUserDataPath()).toBe(app.getPath('userData'))
  })
})
