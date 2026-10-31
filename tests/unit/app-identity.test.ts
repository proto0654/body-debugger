import { describe, expect, it } from 'vitest'
import { resolveAppIdentity } from '../../shared/domain/app-identity'

describe('application identity', () => {
  it('treats the production productName as the stable channel', () => {
    expect(resolveAppIdentity({ packaged: true, name: 'Body Debugger' })).toEqual({
      channel: 'prod',
      appId: 'com.bodydebugger.app',
      title: 'Body Debugger'
    })
  })

  it('treats the dev productName as a separate build', () => {
    expect(resolveAppIdentity({ packaged: true, name: 'Body Debugger Dev' })).toEqual({
      channel: 'dev',
      appId: 'com.bodydebugger.app.dev',
      title: 'Body Debugger Dev'
    })
  })

  it('treats every unpackaged run as dev', () => {
    expect(resolveAppIdentity({ packaged: false, name: 'Body Debugger' }).channel).toBe('dev')
  })
})
