import type { LabPlaybackState } from './laboratory-playback'

export type ChronicleCommand =
  | { action: 'play' }
  | { action: 'pause' }
  | { action: 'seek'; cursor: number }
  | { action: 'step'; direction: -1 | 1; unit: 'event' | 'day' | 'milestone' }
  | { action: 'date'; date: string }

export interface ChroniclePlaybackState {
  cursor: number
  playing: boolean
  eventCount: number
  playback: LabPlaybackState | null
  message: string
}
