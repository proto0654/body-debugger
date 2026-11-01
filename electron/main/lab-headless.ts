import type { LabCommand } from '../../shared/domain/laboratory'
import type {
  DataAddWeightPayload,
  DataRemoveWeightPayload,
  DataSaveProgressPayload,
  DataSaveSettingsPayload,
  ExerciseAddCustomPayload,
  ExerciseRemoveCustomPayload,
  PhotoRemovePayload
} from '../../shared/types/events'
import { IpcChannels } from '../../shared/types/events'
import type { LabBridgeMethod, LabChildMessage, LabParentMessage } from '../../shared/types/lab-bridge'
import { getSnapshot } from './persistence'
import { getLoopState } from './trigger-loop'
import { enqueueLabCommand, getLabState } from './laboratory'
import {
  addWeightRequest,
  removeWeightRequest,
  saveProgressRequest,
  saveSettingsRequest
} from './ipc/persistence'
import { listPhotosRequest, removePhotoRequest } from './ipc/photos'
import {
  addCustomExerciseRequest,
  listCustomExercisesRequest,
  removeCustomExerciseRequest
} from './ipc/custom-exercises'

/**
 * Headless laboratory child: answers the playground bridge with the same
 * services the lab renderer used to reach through ipcMain. The child owns its
 * profile and native popup window; the main app never reads its data directly.
 */
export async function handleLabBridgeRequest(method: LabBridgeMethod, payload?: unknown): Promise<unknown> {
  switch (method) {
    case IpcChannels.DataGetSnapshot: return getSnapshot()
    case IpcChannels.DataSaveSettings: return saveSettingsRequest(payload as DataSaveSettingsPayload)
    case IpcChannels.DataSaveProgress: return saveProgressRequest(payload as DataSaveProgressPayload)
    case IpcChannels.DataAddWeight: return addWeightRequest(payload as DataAddWeightPayload)
    case IpcChannels.DataRemoveWeight: return removeWeightRequest(payload as DataRemoveWeightPayload)
    case IpcChannels.PhotoList: return listPhotosRequest()
    case IpcChannels.PhotoRemove: return removePhotoRequest(payload as PhotoRemovePayload)
    case IpcChannels.ExerciseListCustom: return listCustomExercisesRequest()
    case IpcChannels.ExerciseAddCustom: return addCustomExerciseRequest(payload as ExerciseAddCustomPayload)
    case IpcChannels.ExerciseRemoveCustom: return removeCustomExerciseRequest(payload as ExerciseRemoveCustomPayload)
    case IpcChannels.SessionGetLoopState: return getLoopState()
    case IpcChannels.LabGetState: return getLabState()
    case IpcChannels.LabCommand: return enqueueLabCommand(payload as LabCommand)
    default: throw new Error('Unknown laboratory bridge method')
  }
}

function send(message: LabChildMessage): void {
  try {
    process.send?.(message)
  } catch {
    // Parent already closed; the child is shutting down.
  }
}

export function startHeadlessLabBridge(): void {
  process.on('message', (message: LabParentMessage) => {
    if (!message || message.type !== 'request') return
    const { request } = message
    void handleLabBridgeRequest(request.method, request.payload)
      .then(value => {
        send({ type: 'response', response: { id: request.id, ok: true, value } })
      })
      .catch((cause: unknown) => {
        const error = cause instanceof Error ? cause.message : String(cause)
        send({ type: 'response', response: { id: request.id, ok: false, error } })
      })
  })
  send({ type: 'ready' })
}
