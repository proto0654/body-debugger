import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ComicBubble from '@/components/character/ComicBubble.vue'

describe('ComicBubble', () => {
  it('renders the supplied caption as plain text in a semantic heading', () => {
    const wrapper = mount(ComicBubble, {
      props: { caption: '<b>НОВАЯ ФОРМА!</b>', heading: true, tone: 'milestone' }
    })
    expect(wrapper.element.tagName).toBe('H2')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toBe('<b>НОВАЯ ФОРМА!</b>')
  })
})
