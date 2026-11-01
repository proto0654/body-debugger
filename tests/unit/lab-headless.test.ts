// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels } from '@shared/types/events'

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(() => ({ sessions: [] })),
  loop: vi.fn(() => ({ paused: false })),
  labState: vi.fn(() => ({ cursor: 1 })),
  command: vi.fn(async () => ({ cursor: 2 })),
  saveSettings: vi.fn(async () => ({ settings: {} })),
  listPhotos: vi.fn(() => []),
  removePhoto: vi.fn(() => ({ removed: true, photos: [] })),
  listExercises: vi.fn(() => []),
  addExercise: vi.fn(() => ({ exercise: null, exercises: [] }))
}))

vi.mock('../../electron/main/persistence', () => ({ getSnapshot: mocks.snapshot }))
vi.mock('../../electron/main/trigger-loop', () => ({ getLoopState: mocks.loop }))
vi.mock('../../electron/main/laboratory', () => ({
  getLabState: mocks.labState,
  enqueueLabCommand: mocks.command
}))
vi.mock('../../electron/main/ipc/persistence', () => ({
  saveSettingsRequest: mocks.saveSettings,
  saveProgressRequest: vi.fn(),
  addWeightRequest: vi.fn(),
  removeWeightRequest: vi.fn()
}))
vi.mock('../../electron/main/ipc/photos', () => ({
  listPhotosRequest: mocks.listPhotos,
  removePhotoRequest: mocks.removePhoto
}))
vi.mock('../../electron/main/ipc/custom-exercises', () => ({
  listCustomExercisesRequest: mocks.listExercises,
  addCustomExerciseRequest: mocks.addExercise,
  removeCustomExerciseRequest: vi.fn()
}))

beforeEach(() => { vi.clearAllMocks() })

describe('headless laboratory bridge dispatcher', () => {
  it('routes playground requests to the laboratory services', async () => {
    const { handleLabBridgeRequest } = await import('../../electron/main/lab-headless')
    await expect(handleLabBridgeRequest(IpcChannels.DataGetSnapshot)).resolves.toEqual({ sessions: [] })
    await expect(handleLabBridgeRequest(IpcChannels.SessionGetLoopState)).resolves.toEqual({ paused: false })
    await expect(handleLabBridgeRequest(IpcChannels.LabGetState)).resolves.toEqual({ cursor: 1 })
    await expect(handleLabBridgeRequest(IpcChannels.LabCommand, { action: 'seek', cursor: 2 })).resolves.toEqual({ cursor: 2 })
    expect(mocks.command).toHaveBeenCalledWith({ action: 'seek', cursor: 2 })
    await handleLabBridgeRequest(IpcChannels.DataSaveSettings, { intervalMinutes: 30 })
    expect(mocks.saveSettings).toHaveBeenCalledWith({ intervalMinutes: 30 })
    await handleLabBridgeRequest(IpcChannels.PhotoList)
    await handleLabBridgeRequest(IpcChannels.PhotoRemove, { id: 'p1' })
    expect(mocks.removePhoto).toHaveBeenCalledWith({ id: 'p1' })
    await handleLabBridgeRequest(IpcChannels.ExerciseListCustom)
    await handleLabBridgeRequest(IpcChannels.ExerciseAddCustom, { exercise: {} })
    expect(mocks.addExercise).toHaveBeenCalledWith({ exercise: {} })
  })

  it('rejects unknown methods', async () => {
    const { handleLabBridgeRequest } = await import('../../electron/main/lab-headless')
    await expect(handleLabBridgeRequest('unknown' as never)).rejects.toThrow('Unknown laboratory bridge method')
  })
})
