import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsPanel from '@/components/stats/StatsPanel.vue'
import type { Session } from '@shared/types/session'
import { makeSession } from '../fixtures'

const NOW = new Date(2026, 9, 30, 12, 0, 0)

function at(daysBack: number): string {
  return new Date(2026, 9, 30 - daysBack, 10, 0, 0).toISOString()
}

function done(exerciseId: string, daysBack: number): Session {
  return makeSession({
    exerciseId,
    status: 'done',
    triggeredAt: at(daysBack),
    completedAt: at(daysBack)
  })
}

describe('StatsPanel', () => {
  it('shows the activity summary', () => {
    const wrapper = mount(StatsPanel, {
      props: {
        sessions: [
          done('neck-tilts', 0),
          done('neck-tilts', 1),
          done('plank', 2),
          makeSession({
            exerciseId: 'plank',
            status: 'skipped',
            triggeredAt: at(0),
            completedAt: at(0)
          })
        ],
        now: NOW
      }
    })

    expect(wrapper.get('[data-testid="stat-done"]').text()).toContain('3')
    expect(wrapper.get('[data-testid="stat-active-days"]').text()).toContain('3')
    expect(wrapper.get('[data-testid="stat-week"]').text()).toContain('3')
    expect(wrapper.get('[data-testid="stat-skipped"]').text()).toContain('1')
  })

  it('renders the zone distribution and top exercises from the catalog', () => {
    const wrapper = mount(StatsPanel, {
      props: {
        sessions: [done('neck-tilts', 0), done('neck-tilts', 1), done('plank', 2)],
        now: NOW
      }
    })

    expect(wrapper.get('[data-zone="neck"]').text()).toContain('2')
    expect(wrapper.get('[data-zone="core"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="top-exercises"]').text()).toContain('Наклоны головы')
    expect(wrapper.get('[data-testid="top-exercises"]').text()).toContain('Планка')
  })

  it('renders a seven-day activity chart', () => {
    const wrapper = mount(StatsPanel, {
      props: { sessions: [done('neck-tilts', 0), done('plank', 2)], now: NOW }
    })

    const bars = wrapper.findAll('[data-week-bar]')
    expect(bars).toHaveLength(7)
    expect(wrapper.get('[data-week-bar="2026-10-30"]').attributes('data-done')).toBe('1')
    expect(wrapper.get('[data-week-bar="2026-10-28"]').attributes('data-done')).toBe('1')
    expect(wrapper.get('[data-week-bar="2026-10-29"]').attributes('data-done')).toBe('0')
    expect(wrapper.get('[data-testid="week-chart"]').text()).toContain('7 дней')
  })

  it('shows an empty state before the first done session', () => {
    const wrapper = mount(StatsPanel, { props: { sessions: [], now: NOW } })

    expect(wrapper.text()).toContain('Пока нет выполненных сессий')
    expect(wrapper.find('[data-testid="zone-list"]').exists()).toBe(false)
  })
})
