import { describe, expect, it } from 'vitest'
import {
  isTrayPinSupported,
  notifyIconEntryForExe,
  parseNotifyIconLines
} from '../../shared/domain/tray-pin'

describe('tray pin rules', () => {
  it('allows the setting only for an installed Windows build that has the icon list', () => {
    expect(isTrayPinSupported({ packaged: true, platform: 'win32', settingsKeyPresent: true })).toBe(true)
    expect(isTrayPinSupported({ packaged: false, platform: 'win32', settingsKeyPresent: true })).toBe(false)
    expect(isTrayPinSupported({ packaged: true, platform: 'linux', settingsKeyPresent: true })).toBe(false)
    expect(isTrayPinSupported({ packaged: true, platform: 'win32', settingsKeyPresent: false })).toBe(false)
  })

  it('parses promoted icons and matches the executable ignoring case and slashes', () => {
    const entries = parseNotifyIconLines([
      '{one}\tC:/Apps/Body Debugger/Body Debugger.exe\t0',
      '{two}\tD:\\Other\\electron.exe\t1',
      'noise'
    ].join('\n'))

    expect(entries).toEqual([
      { name: '{one}', executablePath: 'C:/Apps/Body Debugger/Body Debugger.exe', promoted: false },
      { name: '{two}', executablePath: 'D:\\Other\\electron.exe', promoted: true }
    ])
    expect(notifyIconEntryForExe(entries, 'c:\\apps\\body debugger\\body debugger.exe')?.name).toBe('{one}')
    expect(notifyIconEntryForExe(entries, 'D:/missing.exe')).toBeNull()
  })
})
