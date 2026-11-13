import { describe, expect, it } from 'vitest'
import {
  isMacAppTranslocated,
  macUpdateInstallGate,
  macUpdateRelocateMessage,
  resolveMacAppBundlePath
} from '../../shared/domain/mac-update'

describe('resolveMacAppBundlePath', () => {
  it('returns the .app bundle three levels above the executable', () => {
    expect(
      resolveMacAppBundlePath('/Applications/Body Debugger.app/Contents/MacOS/Body Debugger')
    ).toBe('/Applications/Body Debugger.app')
  })

  it('rejects paths that are not inside a Mac bundle', () => {
    expect(resolveMacAppBundlePath('C:\\Program Files\\Body Debugger\\Body Debugger.exe')).toBeNull()
    expect(resolveMacAppBundlePath('/usr/local/bin/body-debugger')).toBeNull()
  })
})

describe('mac update install gate', () => {
  const execPath = '/Applications/Body Debugger.app/Contents/MacOS/Body Debugger'

  it('allows a writable Applications install', () => {
    expect(macUpdateInstallGate({ execPath, parentWritable: true })).toEqual({
      ok: true,
      appPath: '/Applications/Body Debugger.app'
    })
  })

  it('blocks App Translocation copies', () => {
    const translocated =
      '/private/var/folders/xx/AppTranslocation/ABC/d/Body Debugger.app/Contents/MacOS/Body Debugger'
    expect(isMacAppTranslocated(resolveMacAppBundlePath(translocated)!)).toBe(true)
    expect(macUpdateInstallGate({ execPath: translocated, parentWritable: true })).toEqual({
      ok: false,
      reason: 'not-relocated'
    })
  })

  it('blocks a read-only parent directory', () => {
    expect(macUpdateInstallGate({ execPath, parentWritable: false })).toEqual({
      ok: false,
      reason: 'not-writable'
    })
  })

  it('blocks a non-bundle executable', () => {
    expect(macUpdateInstallGate({ execPath: '/tmp/Body Debugger', parentWritable: true })).toEqual({
      ok: false,
      reason: 'not-bundle'
    })
  })

  it('explains relocation in Russian for the update UI', () => {
    expect(macUpdateRelocateMessage()).toContain('Программы')
  })
})
