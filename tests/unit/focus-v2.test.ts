// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { migrateFocusV1, normalizeFocusV2, effectiveFocus } from '@shared/domain/focus-v2'

describe('focus v2 migration', () => {
  it('maps primary to ++ and accents to +', () => {
    const focus = migrateFocusV1({
      primary: 'strength',
      accents: ['mobility', 'body_belts']
    })
    expect(focus.methods.strength).toBe(2)
    expect(focus.methods.mobility).toBe(1)
    expect(focus.zones.upper).toBe(1)
    expect(focus.zones.lower).toBe(1)
  })

  it('falls back to v1 when focusV2 is missing', () => {
    const focus = normalizeFocusV2(undefined, { primary: 'cardio' as never, accents: [] })
    // invalid primary dropped by migrate via isFocusDirection — light_athletics maps cardio
    expect(normalizeFocusV2(undefined, { primary: 'light_athletics', accents: [] }).methods.cardio).toBe(2)
    void focus
  })

  it('applies profile shifts on top of base focus', () => {
    const base = migrateFocusV1({ primary: null, accents: [] })
    const effective = effectiveFocus(base, [
      {
        axis: 'zone',
        key: 'core',
        level: 2,
        until: '2099-01-01T00:00:00.000Z',
        changesetId: 'cs-1'
      }
    ])
    expect(effective.zones.core).toBe(2)
  })
})
