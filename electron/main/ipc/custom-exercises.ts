import { ipcMain } from 'electron'
import {
  IpcChannels,
  type ExerciseAddCustomPayload,
  type ExerciseRemoveCustomPayload,
  type ExercisesUpdatedPayload
} from '../../../shared/types/events'
import { broadcastToWindows } from '../broadcast'
import {
  addCustomExercise,
  listCustomExercises,
  removeCustomExercise
} from '../custom-exercises'

/**
 * AI proposal layer IPC (CONCEPT.md §9): only already-validated exercises reach
 * this channel, and main re-validates them before writing.
 */
export function registerCustomExerciseIpc(): void {
  ipcMain.handle(IpcChannels.ExerciseListCustom, async () => listCustomExercises())

  ipcMain.handle(
    IpcChannels.ExerciseAddCustom,
    async (_event, payload: ExerciseAddCustomPayload) => {
      const exercise = addCustomExercise(payload?.exercise)
      const exercises = listCustomExercises()
      if (exercise) {
        const updated: ExercisesUpdatedPayload = { exercises }
        broadcastToWindows(IpcChannels.ExercisesUpdated, updated)
      }
      return { exercise, exercises }
    }
  )

  ipcMain.handle(
    IpcChannels.ExerciseRemoveCustom,
    async (_event, payload: ExerciseRemoveCustomPayload) => {
      const removed = removeCustomExercise(payload?.id)
      const exercises = listCustomExercises()
      const updated: ExercisesUpdatedPayload = { exercises }
      broadcastToWindows(IpcChannels.ExercisesUpdated, updated)
      return { removed, exercises }
    }
  )
}
