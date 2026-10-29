import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import AiProposalPanel from '@/components/ai/AiProposalPanel.vue'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import type { Exercise } from '@shared/types/exercise'
import { makeExercise } from '../fixtures'

const proposal: Exercise = {
  id: 'ai-neck-reset',
  title: 'Сброс шеи',
  description: 'Медленные кивки и повороты без боли.',
  durationSec: 40,
  difficulty: 2,
  category: 'neck',
  group: 'upper',
  emojiFallback: '🧘'
}

const listCustomExercises = vi.fn(async () => [] as Exercise[])
const addCustomExercise = vi.fn(async () => ({ exercise: proposal, exercises: [proposal] }))
const removeCustomExercise = vi.fn(async () => ({ removed: true, exercises: [] }))

function mountPanel(enabled = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(AiProposalPanel, {
    props: { enabled },
    global: { plugins: [pinia] }
  })
}

let wrapper: VueWrapper | null = null

async function flush(): Promise<void> {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  listCustomExercises.mockReset()
  listCustomExercises.mockResolvedValue([])
  addCustomExercise.mockClear()
  removeCustomExercise.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { listCustomExercises, addCustomExercise, removeCustomExercise }
  })
})

describe('AiProposalPanel', () => {
  it('is hidden when the AI layer is off', () => {
    wrapper = mountPanel(false)
    expect(wrapper.find('[data-testid="ai-panel"]').exists()).toBe(false)
  })

  it('rejects broken JSON with a readable error', async () => {
    wrapper = mountPanel()
    await wrapper.get('[data-testid="ai-input"]').setValue('{ "id": ')

    await wrapper.get('[data-testid="ai-check"]').trigger('click')

    expect(wrapper.get('[data-testid="ai-error"]').text()).toContain('JSON')
    expect(wrapper.find('[data-testid="ai-preview"]').exists()).toBe(false)
  })

  it('previews a valid proposal and approves it explicitly', async () => {
    wrapper = mountPanel()
    await wrapper.get('[data-testid="ai-input"]').setValue(JSON.stringify(proposal))

    await wrapper.get('[data-testid="ai-check"]').trigger('click')
    expect(wrapper.get('[data-testid="ai-preview"]').text()).toContain('Сброс шеи')

    await wrapper.get('[data-testid="ai-approve"]').trigger('click')
    await flush()

    expect(addCustomExercise).toHaveBeenCalledWith({ exercise: proposal })
    expect(wrapper.get('[data-testid="ai-status"]').text()).toContain('добавлено')
  })

  it('blocks approving a shipped id', async () => {
    wrapper = mountPanel()
    const clash = { ...proposal, id: EXERCISE_CATALOG[0].id }
    await wrapper.get('[data-testid="ai-input"]').setValue(JSON.stringify(clash))

    await wrapper.get('[data-testid="ai-check"]').trigger('click')

    expect(wrapper.get('[data-testid="ai-error"]').text()).toContain('id')
    expect(wrapper.get('[data-testid="ai-approve"]').attributes('disabled')).toBeDefined()
  })

  it('lists approved exercises and removes one', async () => {
    const custom = makeExercise({ id: 'ai-neck-reset', title: 'Сброс шеи' })
    listCustomExercises.mockResolvedValue([custom])
    wrapper = mountPanel()
    await flush()

    expect(wrapper.get('[data-testid="ai-approved"]').text()).toContain('Сброс шеи')

    await wrapper.get('[data-ai-remove="ai-neck-reset"]').trigger('click')
    await nextTick()

    expect(removeCustomExercise).toHaveBeenCalledWith({ id: 'ai-neck-reset' })
  })
})
