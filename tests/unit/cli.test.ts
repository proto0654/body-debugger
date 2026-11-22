import { describe, expect, it } from 'vitest'
import {
  OPEN_DASHBOARD_ARG,
  parseAppCommand,
  TRIGGER_NOW_ARG
} from '../../shared/domain/cli'
import { LAUNCH_HIDDEN_ARG } from '../../shared/domain/launch-at-login'

describe('launch command flags', () => {
  it('recognises the trigger-now flag', () => {
    expect(parseAppCommand(['Body Debugger.exe', TRIGGER_NOW_ARG])).toBe('trigger-now')
  })

  it('recognises the open-dashboard flag', () => {
    expect(parseAppCommand(['Body Debugger.exe', OPEN_DASHBOARD_ARG])).toBe('open-dashboard')
  })

  it('returns null without any known flag', () => {
    expect(parseAppCommand([])).toBeNull()
    expect(parseAppCommand(['Body Debugger.exe'])).toBeNull()
  })

  it('ignores unknown flags', () => {
    expect(parseAppCommand(['Body Debugger.exe', '--unknown', '--maybe-dashboard'])).toBeNull()
  })

  it('uses the first known flag when both are present', () => {
    expect(parseAppCommand([TRIGGER_NOW_ARG, OPEN_DASHBOARD_ARG])).toBe('trigger-now')
    expect(parseAppCommand([OPEN_DASHBOARD_ARG, TRIGGER_NOW_ARG])).toBe('open-dashboard')
  })

  it('treats the hidden login-item flag as no command', () => {
    expect(parseAppCommand(['Body Debugger.exe', LAUNCH_HIDDEN_ARG])).toBeNull()
  })
})
