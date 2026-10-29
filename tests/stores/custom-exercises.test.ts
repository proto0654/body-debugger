import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { makeExercise } from '../fixtures'

const custom = makeExercise({ id: 'ai-neck-reset', title: 'Сброс шеи' })

const listCustomExercises = vi.fn(async () => [custom])
const addCustomExercise = vi.fn(async () => ({ exercise: custom, exercises: [custom] }))
const removeCustomExercise = vi.fn(async () => ({ removed: true, exercises: [] }))

beforeEach(() => {
  setActivePinia(createPinia())
  listCustomExercises.mockClear()
  addCustomExercise.mockClear()
  removeCustomExercise.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { listCustomExercises, addCustomExercise, removeCustomExercise }
  })
})

describe('custom exercises store', () => {
  it('hydrates a copy', () => {
    const source = [{ ...custom }]
    const store = useCustomExercisesStore()
    store.hydrate(source)

    source[0].title = 'changed'
    expect(store.entries[0].title).toBe('Сброс шеи')
  })

  it('refreshes approved exercises from main', async () => {
    const store = useCustomExercisesStore()
    await store.refresh()

    expect(listCustomExercises).toHaveBeenCalledTimes(1)
    expect(store.entries).toEqual([custom])
  })

  it('approves through main and adopts the returned list', async () => {
    const store = useCustomExercisesStore()

    const added = await store.approve(custom)

    expect(added).toEqual(custom)
    expect(addCustomExercise).toHaveBeenCalledWith({ exercise: custom })
    expect(store.entries).toEqual([custom])
  })

  it('removes through main and adopts the returned list', async () => {
    const store = useCustomExercisesStore()
    store.hydrate([custom])

    await store.remove(custom.id)

    expect(removeCustomExercise).toHaveBeenCalledWith({ id: custom.id })
    expect(store.entries).toEqual([])
  })

  it('stays empty without the preload bridge', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    const store = useCustomExercisesStore()

    await expect(store.refresh()).resolves.toBeUndefined()
    await expect(store.approve(custom)).resolves.toBeNull()
    expect(store.entries).toEqual([])
  })
})
