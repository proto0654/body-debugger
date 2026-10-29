import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CalendarHeatmap from '@/components/stats/CalendarHeatmap.vue'
import type { Session } from '@shared/types/session'
import { makeSession } from '../fixtures'

const NOW = new Date(2026, 9, 30, 12, 0, 0)

function at(daysBack: number): string {
  return new Date(2026, 9, 30 - daysBack, 10, 0, 0).toISOString()
}

function done(exerciseId: string, daysBack: number, id?: string): Session {
  return makeSession({
    id,
    exerciseId,
    status: 'done',
    triggeredAt: at(daysBack),
    completedAt: at(daysBack)
  })
}

describe('CalendarHeatmap', () => {
  it('renders a cell for every day of the window', () => {
    const wrapper = mount(CalendarHeatmap, {
      props: { sessions: [], now: NOW, days: 14 }
    })

    expect(wrapper.findAll('[data-testid="heatmap-cell"]')).toHaveLength(14)
    expect(wrapper.find('[data-testid="heatmap-legend"]').exists()).toBe(true)
  })

  it('exposes the intensity and a readable label per cell', () => {
    const wrapper = mount(CalendarHeatmap, {
      props: {
        sessions: [done('neck-tilts', 0), done('neck-tilts', 0, 'second')],
        now: NOW,
        days: 7
      }
    })

    const today = wrapper.get('[data-date="2026-10-30"]')
    expect(today.attributes('data-level')).toBe('2')
    expect(today.attributes('title')).toContain('30.10.2026')
    expect(today.attributes('title')).toContain('2 выполнено')
  })

  it('shows the selected day details, including skipped sessions', async () => {
    const wrapper = mount(CalendarHeatmap, {
      props: {
        sessions: [
          done('neck-tilts', 0),
          makeSession({
            exerciseId: 'plank',
            status: 'skipped',
            triggeredAt: at(0),
            completedAt: at(0)
          })
        ],
        now: NOW,
        days: 7
      }
    })

    await wrapper.get('[data-date="2026-10-30"]').trigger('click')

    const details = wrapper.get('[data-testid="heatmap-day"]')
    expect(details.text()).toContain('30.10.2026')
    expect(details.text()).toContain('1 выполнено')
    expect(details.text()).toContain('1 пропущено')
    expect(details.text()).toContain('Наклоны головы')
  })

  it('marks a day without activity as level zero', () => {
    const wrapper = mount(CalendarHeatmap, {
      props: { sessions: [], now: NOW, days: 3 }
    })
    expect(wrapper.get('[data-date="2026-10-28"]').attributes('data-level')).toBe('0')
  })
})
