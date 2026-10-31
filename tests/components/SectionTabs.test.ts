import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'

describe('section navigation', () => {
  it('moves focus and selection with arrows, Home and End and labels the active panel', async () => {
    const view = mount(SectionTabs, { attachTo: document.body, props: {
      modelValue: 'calendar', label: 'Прогресс',
      items: [{ id: 'calendar', label: 'Календарь' }, { id: 'stats', label: 'Статистика' }, { id: 'weight', label: 'Вес' }]
    } })
    const buttons = view.findAll('[role="tab"]')
    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(view.emitted('update:modelValue')?.at(-1)).toEqual(['weight'])
    expect(document.activeElement).toBe(buttons[2]!.element)
    await view.setProps({ modelValue: 'weight' })
    expect(view.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(buttons[2]!.attributes('id'))
    expect(buttons[2]!.attributes('tabindex')).toBe('0')
    expect(buttons[0]!.attributes('tabindex')).toBe('-1')
    await buttons[2]!.trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    await buttons[0]!.trigger('keydown', { key: 'End' })
    await nextTick()
    expect(document.activeElement).toBe(buttons[2]!.element)
    view.unmount()
  })
})
