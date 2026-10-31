import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import SoundAuditionPanel from '@/debug/SoundAuditionPanel.vue'
import { EFFECT_CLIPS, VOICE_CLIPS } from '@/voice-assets'

class FakeAudio {
  static instances: FakeAudio[] = []
  src: string
  volume = 1
  pause = vi.fn()
  play = vi.fn(() => Promise.resolve())
  private handlers = new Map<string, (() => void)[]>()

  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }

  addEventListener(type: string, handler: () => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler])
  }

  removeAttribute(): void {
    this.src = ''
  }

  emit(type: string): void {
    for (const handler of this.handlers.get(type) ?? []) handler()
  }
}

let wrapper: VueWrapper | undefined

beforeEach(() => {
  setActivePinia(createPinia())
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

function panel() {
  wrapper = mount(SoundAuditionPanel)
  return wrapper
}

describe('sound audition panel', () => {
  it('plays every variant of an event in order and stops on request', async () => {
    const view = panel()
    await view.get('[data-audition-play-event="done"]').trigger('click')

    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0].src).toContain('desk-hulk__done__01__take-1.mp3')

    FakeAudio.instances[0].emit('ended')
    expect(FakeAudio.instances[1].src).toContain('desk-hulk__done__02__take-1.mp3')

    await view.get('[data-testid="audition-stop"]').trigger('click')
    expect(FakeAudio.instances[1].pause).toHaveBeenCalled()
    expect(view.get('[data-testid="audition-stop"]').attributes('disabled')).toBeDefined()
  })

  it('plays one clip and switches the voice with the character picker', async () => {
    const view = panel()
    await view.get('[data-audition-clip="desk-hulk__ready__01"]').trigger('click')
    expect(FakeAudio.instances[0].src).toContain('desk-hulk__ready__01__take-1.mp3')

    await view.get('[data-testid="audition-character"]').setValue('engineer')
    await view.get('[data-audition-play-event="ready"]').trigger('click')
    const played = FakeAudio.instances.at(-1)!
    expect(played.src).toContain('engineer__ready__01__take-1.mp3')
  })

  it('lists the shared effects and plays the archived take', async () => {
    const view = panel()
    const buttons = view.findAll('[data-audition-effect]')
    expect(buttons).toHaveLength(EFFECT_CLIPS.length)

    await view.get('[data-audition-effect="system__skip__01"]').trigger('click')
    expect(FakeAudio.instances[0].src).toContain('system__skip__01__take-1.mp3')
  })

  it('covers the whole generated voice package', () => {
    const view = panel()
    expect(view.findAll('[data-audition-clip]')).toHaveLength(VOICE_CLIPS.filter((clip) => clip.characterId === 'desk-hulk').length)
    expect(view.findAll('[data-audition-play-event]').length).toBeGreaterThanOrEqual(12)
  })

  it('shows a warning instead of silence when playback fails', async () => {
    vi.stubGlobal('Audio', class extends FakeAudio {
      play = vi.fn(() => Promise.reject(new Error('no device')))
    })
    const view = panel()
    await view.get('[data-audition-clip="desk-hulk__ready__01"]').trigger('click')
    await Promise.resolve()
    expect(view.get('[role="alert"]').text()).toContain('Не удалось воспроизвести')
  })
})
