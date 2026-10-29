/// <reference types="vite/client" />

import type {
  DataAddWeightPayload,
  DataRemoveWeightPayload,
  DataSaveProgressPayload,
  DataSaveSettingsPayload,
  DataSnapshotPayload,
  DataUpdatedPayload,
  SessionLoopStatePayload,
  SessionPopupPayload,
  SessionResultPayload,
  TraySetStatePayload
} from '@shared/types/events'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

export interface BodyDebuggerApi {
  openDashboard: () => Promise<void>
  openPopup: () => Promise<void>
  closePopup: () => Promise<void>
  resizePopup: (height: number) => Promise<void>
  sessionResult: (payload: SessionResultPayload) => Promise<void>
  getCurrentPopup: () => Promise<SessionPopupPayload | null>
  getLoopState: () => Promise<SessionLoopStatePayload>
  getSnapshot: () => Promise<DataSnapshotPayload>
  saveSettings: (payload: DataSaveSettingsPayload) => Promise<DataSnapshotPayload>
  saveProgress: (payload: DataSaveProgressPayload) => Promise<DataSnapshotPayload>
  addWeight: (payload: DataAddWeightPayload) => Promise<DataSnapshotPayload>
  removeWeight: (payload: DataRemoveWeightPayload) => Promise<DataSnapshotPayload>
  onLoopStateChanged: (handler: (payload: SessionLoopStatePayload) => void) => () => void
  onTrayState: (handler: (payload: TraySetStatePayload) => void) => () => void
  onDataUpdated: (handler: (payload: DataUpdatedPayload) => void) => () => void
}

declare global {
  interface Window {
    api: BodyDebuggerApi
  }
}

export {}
