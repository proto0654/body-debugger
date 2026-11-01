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

export function listCustomExercisesRequest(): ReturnType<typeof listCustomExercises> {
  return listCustomExercises()
}

export function addCustomExerciseRequest(payload: ExerciseAddCustomPayload): {
  exercise: ReturnType<typeof addCustomExercise>
  exercises: ReturnType<typeof listCustomExercises>
} {
  const exercise = addCustomExercise(payload?.exercise)
  const exercises = listCustomExercises()
  if (exercise) {
    const updated: ExercisesUpdatedPayload = { exercises }
    broadcastToWindows(IpcChannels.ExercisesUpdated, updated)
  }
  return { exercise, exercises }
}

export function removeCustomExerciseRequest(payload: ExerciseRemoveCustomPayload): {
  removed: boolean
  exercises: ReturnType<typeof listCustomExercises>
} {
  const removed = removeCustomExercise(payload?.id)
  const exercises = listCustomExercises()
  const updated: ExercisesUpdatedPayload = { exercises }
  broadcastToWindows(IpcChannels.ExercisesUpdated, updated)
  return { removed, exercises }
}

/**
 * AI proposal layer IPC (CONCEPT.md §9): only already-validated exercises reach
 * this channel, and main re-validates them before writing.
 */
export function registerCustomExerciseIpc(): void {
  ipcMain.handle(IpcChannels.ExerciseListCustom, () => listCustomExercisesRequest())

  ipcMain.handle(
    IpcChannels.ExerciseAddCustom,
    (_event, payload: ExerciseAddCustomPayload) => addCustomExerciseRequest(payload)
  )

  ipcMain.handle(
    IpcChannels.ExerciseRemoveCustom,
    (_event, payload: ExerciseRemoveCustomPayload) => removeCustomExerciseRequest(payload)
  )
}
