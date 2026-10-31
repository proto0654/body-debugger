import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ComicBubble from '@/components/character/ComicBubble.vue'

describe('ComicBubble', () => {
  it('restarts the visual when the same caption receives a new animation identity', async () => {
    const view = mount(ComicBubble, { props: { caption: 'ЕСТЬ!', variant: 'burst', animationId: 1 } })
    const previous = view.element
    await view.setProps({ animationId: 2 })
    expect(view.element).not.toBe(previous)
    expect(view.get('span').text()).toBe('ЕСТЬ!')
    expect(view.get('svg').attributes('aria-hidden')).toBe('true')
    view.unmount()
  })
  it('renders the supplied caption as plain text in a semantic heading', () => {
    const wrapper = mount(ComicBubble, {
      props: { caption: '<b>НОВАЯ ФОРМА!</b>', heading: true, tone: 'milestone' }
    })
    expect(wrapper.element.tagName).toBe('H2')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toBe('<b>НОВАЯ ФОРМА!</b>')
  })
})
