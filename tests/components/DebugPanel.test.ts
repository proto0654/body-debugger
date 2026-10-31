import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import DebugPanel from '@/debug/DebugPanel.vue'

const openLaboratory = vi.fn(async () => undefined)
let wrapper: VueWrapper | undefined
beforeEach(() => {
  setActivePinia(createPinia())
  openLaboratory.mockReset()
  Object.defineProperty(window, 'api', { configurable: true, value: { openLaboratory } })
})
afterEach(() => { wrapper?.unmount() })

describe('DebugPanel laboratory entry', () => {
  it('uses the build default when the dashboard omits the optional visibility prop', () => {
    wrapper = mount(DebugPanel)
    expect(wrapper.find('[data-testid="lab-launch"]').exists()).toBe(true)
  })
  it('hides the entry outside a debug build', () => {
    wrapper = mount(DebugPanel, { props: { enabled: false } })
    expect(wrapper.find('[data-testid="debug-panel"]').exists()).toBe(false)
  })
  it('offers an isolated launch and exposes no destructive history controls in a normal profile', async () => {
    wrapper = mount(DebugPanel, { props: { enabled: true } })
    expect(wrapper.text()).toContain('тестовым профилем')
    expect(wrapper.find('[data-testid="debug-reset"]').exists()).toBe(false)
    await wrapper.get('[data-testid="lab-launch"]').trigger('click')
    await flushPromises()
    expect(openLaboratory).toHaveBeenCalledOnce()
  })
  it('reports a launch failure and enables retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    openLaboratory.mockRejectedValueOnce(new Error('spawn failed'))
    wrapper = mount(DebugPanel, { props: { enabled: true } })
    await wrapper.get('[data-testid="lab-launch"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось')
    expect(wrapper.get('[data-testid="lab-launch"]').attributes('disabled')).toBeUndefined()
  })
})
