import { app } from 'electron'
import { join } from 'path'

export function getDataDir(): string {
  return join(app.getPath('userData'), 'data')
}

export function getSettingsPath(): string {
  return join(getDataDir(), 'settings.json')
}

export function getProgressPath(): string {
  return join(getDataDir(), 'progress.json')
}

export function getSessionsPath(): string {
  return join(getDataDir(), 'sessions.json')
}

export function getWeightsPath(): string {
  return join(getDataDir(), 'weights.json')
}

/** Photo metadata; the image files live next to the data directory. */
export function getPhotosPath(): string {
  return join(getDataDir(), 'photos.json')
}

export function getPhotoDir(): string {
  return join(app.getPath('userData'), 'photos')
}

/** AI proposals approved by the user (optional layer). */
export function getCustomExercisesPath(): string {
  return join(getDataDir(), 'custom-exercises.json')
}
