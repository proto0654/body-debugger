import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Changeset } from '@shared/domain/changeset'
import type { ChangesetReview } from '@shared/domain/changeset-review'
import type { LlmPreviewRequestPayload, LlmPreviewResponsePayload } from '@shared/types/events'
import { useCatalogStore } from './catalog'

export const useAiAssistantStore = defineStore('aiAssistant', () => {
  const busy = ref(false)
  const error = ref('')
  const status = ref('')
  const changeset = ref<Changeset | null>(null)
  const review = ref<ChangesetReview | null>(null)
  const history = ref<Changeset[]>([])
  const preview = ref<LlmPreviewResponsePayload | null>(null)
  const preparedInput = ref<LlmPreviewRequestPayload | null>(null)
  const instruction = ref('')
  const targetSetId = ref('user-main')
  const hasKey = ref(false)
  let reviewSequence = 0

  async function execute(action: () => Promise<void>): Promise<void> {
    if (busy.value) return
    busy.value = true
    error.value = ''
    status.value = ''
    try { await action() }
    catch (cause) { console.warn('[ai-assistant] action failed', cause); error.value = cause instanceof Error ? cause.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.' }
    finally { busy.value = false }
  }
  async function refreshReview(): Promise<void> {
    const sequence = ++reviewSequence
    review.value = null
    if (changeset.value?.status !== 'awaiting_approval') return
    const next = await window.api.reviewLlmChangeset?.(changeset.value.id)
    if (sequence === reviewSequence) review.value = next ?? null
  }
  async function refreshHistory(): Promise<void> {
    history.value = await window.api.listLlmChangesets()
  }
  function invalidatePreview(): void { preview.value = null; preparedInput.value = null }
  async function prepare(input: LlmPreviewRequestPayload): Promise<void> {
    await execute(async () => {
      invalidatePreview()
      const next = await window.api.previewLlmRequest(input)
      preparedInput.value = structuredClone(input)
      preview.value = next
    })
  }
  async function run(): Promise<void> {
    const input = preparedInput.value ? JSON.parse(JSON.stringify(preparedInput.value)) as LlmPreviewRequestPayload : null
    const shown = preview.value
    if (!input || !shown) return
    await execute(async () => {
      const current = await window.api.previewLlmRequest(input)
      if (JSON.stringify(current.payload) !== JSON.stringify(shown.payload) || current.system !== shown.system) {
        preview.value = current
        error.value = 'Данные запроса обновились. Проверьте их и отправьте ещё раз.'
        return
      }
      const next = await window.api.runLlm(input)
      changeset.value = next
      if (next.status === 'failed') error.value = next.error || 'Запрос не выполнен. Черновик не применён.'
      else status.value = 'Предложения готовы к проверке.'
      invalidatePreview()
      await refreshReview()
      await refreshHistory()
    })
  }
  async function load(id: string): Promise<void> {
    await execute(async () => { changeset.value = await window.api.getLlmChangeset(id); await refreshReview() })
  }
  async function toggle(index: number): Promise<void> {
    if (!changeset.value) return
    await execute(async () => { changeset.value = await window.api.toggleLlmOp({ changesetId: changeset.value!.id, index }); await refreshReview() })
  }
  async function apply(): Promise<void> {
    const current = changeset.value
    const checked = review.value
    if (!current || !checked) return
    await execute(async () => {
      const result = await window.api.applyReviewedLlmChangeset?.({ id: current.id, token: checked.token })
      if (!result) throw new Error('Проверка предложений недоступна. Перезапустите приложение.')
      if (result.status !== 'applied') { error.value = result.message; await refreshReview(); return }
      changeset.value = result.changeset
      review.value = null
      status.value = 'Изменения применены.'
      await useCatalogStore().refresh()
      await refreshHistory()
    })
  }
  async function discard(): Promise<void> {
    if (!changeset.value) return
    await execute(async () => { changeset.value = await window.api.discardLlmChangeset(changeset.value!.id); review.value = null; status.value = 'Черновик отклонён.'; await refreshHistory() })
  }
  async function revert(id: string): Promise<void> {
    await execute(async () => {
      const next = await window.api.revertLlmChangeset(id)
      if (!next) throw new Error('Не удалось отменить применение этого предложения.')
      changeset.value = next
      review.value = null
      await useCatalogStore().refresh()
      await refreshHistory()
      status.value = 'Применение отменено.'
    })
  }
  async function cancel(): Promise<void> {
    try { const result = await window.api.cancelLlm(); status.value = result.cancelled ? 'Запрошена отмена.' : 'Активного запроса нет.' }
    catch (cause) { console.warn('[ai-assistant] cancel failed', cause); error.value = 'Не удалось отменить запрос.' }
  }
  return { busy, error, status, changeset, review, history, preview, preparedInput, instruction, targetSetId, hasKey, execute, refreshReview, refreshHistory, invalidatePreview, prepare, run, load, toggle, apply, discard, revert, cancel }
})
