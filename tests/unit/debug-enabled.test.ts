// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isDebugEnabled } from '@/debug/is-debug-enabled'

describe('isDebugEnabled', () => {
  it('is on in a dev build', () => {
    expect(isDebugEnabled({ DEV: true })).toBe(true)
  })

  it('can be forced with the env flag', () => {
    expect(isDebugEnabled({ DEV: false, VITE_DEBUG_PANEL: '1' })).toBe(true)
  })

  it('stays off in production', () => {
    expect(isDebugEnabled({ DEV: false })).toBe(false)
    expect(isDebugEnabled({ DEV: false, VITE_DEBUG_PANEL: '0' })).toBe(false)
    expect(isDebugEnabled({ DEV: false, VITE_DEBUG_PANEL: 'true' })).toBe(false)
  })
})
