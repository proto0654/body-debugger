import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'

const frameMock = vi.hoisted(() => ({ override: null as string | undefined | null }))

vi.mock('@/components/character/frames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/character/frames')>()
  return {
    ...actual,
    resolveFrameUrl: (candidates: string[], packId?: string) =>
      frameMock.override === null ? actual.resolveFrameUrl(candidates, packId) : frameMock.override
  }
})

describe('CharacterPortrait', () => {
  beforeEach(() => {
    frameMock.override = null
    vi.useRealTimers()
  })

  it('shows neglect art and its accessible label, then restores the earned body on recovery', async () => {
    const wrapper = mount(CharacterPortrait, {
      props: { stage: 5, branch: 'power', build: 'lean', condition: 3 }
    })
    expect(wrapper.get('img').attributes('src')).toMatch(/neglect-3-lean\.png$/)
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('Дрыщ')
    expect(wrapper.text()).toContain('Desk Hulk')
    await wrapper.setProps({ condition: 0 })
    expect(wrapper.get('img').attributes('src')).toMatch(/pose-power-lean\.png$/)
    expect(wrapper.get('[role="img"]').attributes('aria-label')).not.toContain('Дрыщ')
  })

  it('keeps the completion face expressive while the body is degraded', () => {
    const wrapper = mount(CharacterPortrait, {
      props: { variant: 'face', build: 'stocky', condition: 3, emotion: 'happy' }
    })
    expect(wrapper.get('img').attributes('src')).toMatch(/emotion-happy-stocky\.png$/)
  })

  it('renders the stage body for the dashboard', () => {
    const wrapper = mount(CharacterPortrait, {
      props: { stage: 4, branch: 'power', build: 'lean', size: 'lg' }
    })

    expect(wrapper.get('img').attributes('src')).toMatch(/pose-power-lean\.png$/)
    expect(wrapper.text()).toContain('Крепкий · Сила')
    expect(wrapper.get('[title]').attributes('title')).toBe('Крепкий · Сила')
  })

  it('renders the emotion bust for the popup face', () => {
    const wrapper = mount(CharacterPortrait, {
      props: { variant: 'face', stage: 5, branch: 'mobility', build: 'stocky', emotion: 'proud' }
    })

    expect(wrapper.get('img').attributes('src')).toMatch(/emotion-proud-stocky\.png$/)
    expect(wrapper.text()).not.toContain('stage 5')
  })

  it('maps surprised to the happy bust', () => {
    const wrapper = mount(CharacterPortrait, {
      props: { variant: 'face', emotion: 'surprised' }
    })
    expect(wrapper.get('img').attributes('src')).toMatch(/emotion-happy-average\.png$/)
  })

  it('crossfades to the new frame when the emotion changes', async () => {
    const wrapper = mount(CharacterPortrait, {
      props: { variant: 'face', emotion: 'focused' }
    })
    expect(wrapper.get('img').attributes('src')).toMatch(/emotion-focused/)

    await wrapper.setProps({ emotion: 'happy' })
    const sources = wrapper.findAll('img').map((img) => img.attributes('src') ?? '')
    expect(sources.some((src) => /emotion-happy/.test(src))).toBe(true)
  })

  it('bounces briefly when the character becomes happy', async () => {
    vi.useFakeTimers()
    const wrapper = mount(CharacterPortrait, {
      props: { variant: 'face', emotion: 'focused' }
    })

    await wrapper.setProps({ emotion: 'happy' })
    expect(wrapper.get('[title]').classes()).toContain('portrait-bounce')

    vi.advanceTimersByTime(400)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[title]').classes()).not.toContain('portrait-bounce')
  })

  it('falls back to the emoji when no frame resolves', () => {
    frameMock.override = undefined
    const wrapper = mount(CharacterPortrait, {
      props: { emojiFallback: '🦾', size: 'sm' }
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('🦾')
  })

  it('falls back when a bundled image fails to load', async () => {
    const wrapper = mount(CharacterPortrait, { props: { emojiFallback: '💪' } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('💪')
  })
  it('keeps the selected identity through build, neutral and image-load fallbacks', async () => {
    const wrapper = mount(CharacterPortrait, { props: { packId: 'engineer', variant: 'face', emotion: 'happy', build: 'lean' } })
    expect(wrapper.get('img').attributes('src')).toContain('/engineer/frames/emotion-happy-lean.png')
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toContain('/engineer/frames/emotion-happy-average.png')
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toContain('/engineer/frames/emotion-neutral-lean.png')
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toContain('/engineer/frames/emotion-neutral-average.png')
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[role="img"]').attributes('data-frame-fallback')).toBe('true')
    expect(wrapper.emitted('frame-status')!.at(-1)).toEqual([expect.objectContaining({ failed: 4, fallback: true })])
    await wrapper.setProps({ packId: 'hipster' })
    expect(wrapper.get('img').attributes('src')).toContain('/hipster/frames/emotion-happy-lean.png')
  })
})
