import { describe, expect, it } from 'vitest'
import {
  isLaunchAtLoginSupported,
  LAUNCH_HIDDEN_ARG,
  shouldStartHidden
} from '../../shared/domain/launch-at-login'

describe('launch-at-login rules', () => {
  it('is available only in an installed Windows build', () => {
    expect(isLaunchAtLoginSupported({ packaged: true, platform: 'win32' })).toBe(true)
    expect(isLaunchAtLoginSupported({ packaged: false, platform: 'win32' })).toBe(false)
    expect(isLaunchAtLoginSupported({ packaged: true, platform: 'linux' })).toBe(false)
  })

  it('recognises only the explicit hidden argument', () => {
    expect(shouldStartHidden(['Body Debugger.exe', LAUNCH_HIDDEN_ARG])).toBe(true)
    expect(shouldStartHidden(['Body Debugger.exe'])).toBe(false)
    expect(shouldStartHidden(['Body Debugger.exe', '--hidden=false'])).toBe(false)
  })
})
