/// <reference types="vite/client" />

import type {
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
  onShowPopup: (handler: (payload: SessionShowPopupPayload) => void) => () => void
  onTrayState: (handler: (payload: TraySetStatePayload) => void) => () => void
}

declare global {
  interface Window {
    api: BodyDebuggerApi
  }
}

export {}
