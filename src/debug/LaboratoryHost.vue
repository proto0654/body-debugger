<script setup lang="ts">
import { createApp, nextTick, onBeforeUnmount, ref, watch, type App } from 'vue'
import { createPinia, getActivePinia, setActivePinia, type Pinia } from 'pinia'
import type { BodyDebuggerApi } from '@/env'
import LaboratoryPanel from './LaboratoryPanel.vue'
import { pushRendererApi, popRendererApi, rendererApi } from '@/renderer-api'
import type { LabCommand, LabState } from '@shared/domain/laboratory'
import type { LabBridgeMethod } from '@shared/types/lab-bridge'
import { LAB_BRIDGE_METHODS } from '@shared/types/lab-bridge'
import type {
  DataAddWeightPayload,
  DataRemoveWeightPayload,
  DataSaveProgressPayload,
  DataSaveSettingsPayload,
  DataSnapshotPayload,
  DataUpdatedPayload,
  ExerciseAddCustomPayload,
  ExerciseListCustomPayload,
  ExerciseRemoveCustomPayload,
  ExercisesUpdatedPayload,
  PhotoListPayload,
  PhotoRemovePayload,
  PhotosUpdatedPayload,
  SessionLoopStatePayload
} from '@shared/types/events'

const props = defineProps<{ active: boolean }>()

const host = ref<HTMLElement | null>(null)
const error = ref('')
let app: App | null = null
let labPinia: Pinia | null = null
let rootPinia: Pinia | null = null
let unsubscribeHydrate: (() => void) | undefined
let apiPushed = false

function createLabApi(): BodyDebuggerApi {
  const bridge = window.api.labBridgeRequest
  if (!bridge) throw new Error('Laboratory bridge is unavailable')
  const request = <T>(method: LabBridgeMethod, payload?: unknown): Promise<T> =>
    bridge(method, payload) as Promise<T>

  return {
    ...window.api,
    getSnapshot: (): Promise<DataSnapshotPayload> => request(LAB_BRIDGE_METHODS.snapshot),
    saveSettings: (payload: DataSaveSettingsPayload): Promise<DataSnapshotPayload> =>
      request(LAB_BRIDGE_METHODS.saveSettings, payload),
    saveProgress: (payload: DataSaveProgressPayload): Promise<DataSnapshotPayload> =>
      request(LAB_BRIDGE_METHODS.saveProgress, payload),
    addWeight: (payload: DataAddWeightPayload): Promise<DataSnapshotPayload> =>
      request(LAB_BRIDGE_METHODS.addWeight, payload),
    removeWeight: (payload: DataRemoveWeightPayload): Promise<DataSnapshotPayload> =>
      request(LAB_BRIDGE_METHODS.removeWeight, payload),
    listPhotos: (): Promise<PhotoListPayload> => request(LAB_BRIDGE_METHODS.photoList),
    removePhoto: (
      payload: PhotoRemovePayload
    ): Promise<{ removed: boolean; photos: PhotoListPayload }> =>
      request(LAB_BRIDGE_METHODS.photoRemove, payload),
    listCustomExercises: (): Promise<ExerciseListCustomPayload> => request(LAB_BRIDGE_METHODS.exerciseList),
    addCustomExercise: (
      payload: ExerciseAddCustomPayload
    ): Promise<{ exercise: ExerciseListCustomPayload[number] | null; exercises: ExerciseListCustomPayload }> =>
      request(LAB_BRIDGE_METHODS.exerciseAdd, payload),
    removeCustomExercise: (
      payload: ExerciseRemoveCustomPayload
    ): Promise<{ removed: boolean; exercises: ExerciseListCustomPayload }> =>
      request(LAB_BRIDGE_METHODS.exerciseRemove, payload),
    getLoopState: (): Promise<SessionLoopStatePayload> => request(LAB_BRIDGE_METHODS.loopState),
    getLabState: (): Promise<LabState> => request(LAB_BRIDGE_METHODS.labState),
    labCommand: (command: LabCommand): Promise<LabState> =>
      request(LAB_BRIDGE_METHODS.labCommand, command),
    onLabChanged: (handler: (state: LabState) => void): (() => void) =>
      window.api.onLabChanged(handler),
    onDataUpdated: (handler: (payload: DataUpdatedPayload) => void): (() => void) =>
      window.api.onDataUpdated(handler),
    onLoopStateChanged: (handler: (payload: SessionLoopStatePayload) => void): (() => void) =>
      window.api.onLoopStateChanged(handler),
    onPhotosUpdated: (handler: (payload: PhotosUpdatedPayload) => void): (() => void) =>
      window.api.onPhotosUpdated?.(handler) ?? (() => undefined),
    onExercisesUpdated: (handler: (payload: ExercisesUpdatedPayload) => void): (() => void) =>
      window.api.onExercisesUpdated?.(handler) ?? (() => undefined)
  }
}

function activateLabApi(): void {
  if (apiPushed) return
  pushRendererApi(createLabApi())
  apiPushed = true
  if (labPinia) setActivePinia(labPinia)
}

function deactivateLabApi(): void {
  if (!apiPushed) return
  popRendererApi()
  apiPushed = false
  if (rootPinia) setActivePinia(rootPinia)
}

async function mountLab(): Promise<void> {
  if (!host.value || app) return
  error.value = ''
  try {
    window.api.registerLabHost?.()
    rootPinia = getActivePinia() ?? null
    labPinia = createPinia()
    activateLabApi()
    app = createApp(LaboratoryPanel)
    app.use(labPinia)
    setActivePinia(labPinia)
    app.mount(host.value)
    // Initial sandbox hydrate only; later updates arrive via LabChanged.snapshot.
    const api = rendererApi()
    if (api?.getSnapshot) {
      const { applySnapshot } = await import('@/bootstrap/hydrate')
      applySnapshot(await api.getSnapshot())
      const reminder = (await import('@/stores/reminder')).useReminderStore()
      reminder.apply(await api.getLoopState())
      const photos = (await import('@/stores/photos')).usePhotosStore()
      const customExercises = (await import('@/stores/custom-exercises')).useCustomExercisesStore()
      void photos.refresh().catch(() => undefined)
      void customExercises.refresh().catch(() => undefined)
    }
    unsubscribeHydrate = () => undefined
  } catch (cause) {
    console.error('[laboratory-host] failed to mount', cause)
    error.value = 'Не удалось открыть лабораторию'
    teardown()
  }
}

async function pauseLab(): Promise<void> {
  try {
    await rendererApi()?.labCommand?.({ action: 'pause' })
  } catch {
    /* host may already be gone */
  }
}

function teardown(): void {
  unsubscribeHydrate?.()
  unsubscribeHydrate = undefined
  if (app) {
    app.unmount()
    app = null
  }
  labPinia = null
  deactivateLabApi()
}

watch(
  () => props.active,
  async (active) => {
    if (active) {
      await nextTick()
      if (!app) await mountLab()
      else activateLabApi()
    } else if (app) {
      await pauseLab()
      deactivateLabApi()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  void pauseLab().finally(teardown)
})
</script>

<template>
  <section v-show="active" class="laboratory-host min-h-[32rem]" data-testid="laboratory-host">
    <p v-if="error" class="settings-card text-sm text-red-300" role="alert">{{ error }}</p>
    <div ref="host" />
  </section>
</template>
