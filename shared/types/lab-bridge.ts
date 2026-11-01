import { IpcChannels } from './events'

/**
 * Renderer-main bridge used by the native laboratory host in the dashboard.
 * The main process forwards each request to the headless laboratory child and
 * relays its data/lab events back; the real profile never sees these methods.
 */
export const LAB_BRIDGE_METHODS = {
  snapshot: IpcChannels.DataGetSnapshot,
  saveSettings: IpcChannels.DataSaveSettings,
  saveProgress: IpcChannels.DataSaveProgress,
  addWeight: IpcChannels.DataAddWeight,
  removeWeight: IpcChannels.DataRemoveWeight,
  photoList: IpcChannels.PhotoList,
  photoRemove: IpcChannels.PhotoRemove,
  exerciseList: IpcChannels.ExerciseListCustom,
  exerciseAdd: IpcChannels.ExerciseAddCustom,
  exerciseRemove: IpcChannels.ExerciseRemoveCustom,
  loopState: IpcChannels.SessionGetLoopState,
  labState: IpcChannels.LabGetState,
  labCommand: IpcChannels.LabCommand
} as const

export type LabBridgeMethod = (typeof LAB_BRIDGE_METHODS)[keyof typeof LAB_BRIDGE_METHODS]

export interface LabBridgeRequest {
  id: number
  method: LabBridgeMethod
  payload?: unknown
}

export interface LabBridgeResponse {
  id: number
  ok: boolean
  value?: unknown
  error?: string
}

export type LabChildMessage =
  | { type: 'ready' }
  | { type: 'response'; response: LabBridgeResponse }
  | { type: 'event'; channel: string; payload: unknown }

export type LabParentMessage = { type: 'request'; request: LabBridgeRequest }
