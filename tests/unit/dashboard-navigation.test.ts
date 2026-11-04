import { describe, expect, it } from 'vitest'
import { dashboardHash, parseDashboardLocation } from '@shared/domain/dashboard-navigation'

describe('dashboard navigation', () => {
  it.each(['calendar', 'stats'])('preserves the legacy %s deep link', section => {
    expect(parseDashboardLocation(`#/dashboard?tab=${section}`)).toEqual({ tab: 'progress', section })
  })
  it.each(['laboratory', 'playground'])('moves legacy %s into developer settings', tab => {
    expect(parseDashboardLocation(`#/dashboard?tab=${tab}`)).toEqual({ tab: 'settings', section: 'laboratory' })
  })
  it('round trips selected exercises and contextual AI tasks', () => {
    const location = { tab: 'exercises' as const, section: 'ai', task: 'tune' as const, exerciseId: 'id with / и &' }
    expect(parseDashboardLocation(dashboardHash(location))).toEqual(location)
  })
  it('normalizes invalid and prototype-key navigation input', () => {
    expect(parseDashboardLocation('#/dashboard?tab=__proto__')).toEqual({ tab: 'today', section: 'overview' })
    expect(parseDashboardLocation('#/dashboard?tab=settings&section=missing')).toEqual({ tab: 'settings', section: 'general' })
  })
})
