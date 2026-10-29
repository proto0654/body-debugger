import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'
import { useSettingsStore } from '@/stores/settings'
import { makeSettings } from '../fixtures'

describe('App shell', () => {
  const root = document.documentElement

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    delete root.dataset.theme
    delete root.dataset.reduceMotion
  })

  it('mirrors the stored theme onto <html>', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useSettingsStore().hydrate(makeSettings({ themeId: 'night' }))

    const wrapper = mount(App, { global: { plugins: [pinia], stubs: { RouterView: true } } })
    await nextTick()

    expect(root.dataset.theme).toBe('night')
    wrapper.unmount()
  })

  it('falls back to the default theme for an unknown stored id', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useSettingsStore().hydrate(makeSettings({ themeId: 'rave' }))

    const wrapper = mount(App, { global: { plugins: [pinia], stubs: { RouterView: true } } })
    await nextTick()

    expect(root.dataset.theme).toBe('default')
    wrapper.unmount()
  })

  it('mirrors reduced motion onto <html>', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useSettingsStore().hydrate(makeSettings({ reduceMotion: true }))

    const wrapper = mount(App, { global: { plugins: [pinia], stubs: { RouterView: true } } })
    await nextTick()

    expect(root.dataset.reduceMotion).toBe('true')
    wrapper.unmount()
  })
})
