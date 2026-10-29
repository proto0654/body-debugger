/// <reference types="vite/client" />

import type {
  DataSaveProgressPayload,
  DataSaveSettingsPayload,
  DataSnapshotPayload,
  DataUpdatedPayload,
  SessionResultPayload,
  SessionShowPopupPayload,
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
  sessionResult: (payload: SessionResultPayload) => Promise<void>
  getSnapshot: () => Promise<DataSnapshotPayload>
  saveSettings: (payload: DataSaveSettingsPayload) => Promise<DataSnapshotPayload>
  saveProgress: (payload: DataSaveProgressPayload) => Promise<DataSnapshotPayload>
  onShowPopup: (handler: (payload: SessionShowPopupPayload) => void) => () => void
  onTrayState: (handler: (payload: TraySetStatePayload) => void) => () => void
  onDataUpdated: (handler: (payload: DataUpdatedPayload) => void) => () => void
}

declare global {
  interface Window {
    api: BodyDebuggerApi
  }
}

export {}
