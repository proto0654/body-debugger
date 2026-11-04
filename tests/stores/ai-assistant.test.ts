import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiAssistantStore } from '@/stores/ai-assistant'
import type { Changeset } from '@shared/domain/changeset'
import type { LlmPreviewRequestPayload } from '@shared/types/events'

const draft: Changeset = { id: 'draft', kind: 'edit', status: 'awaiting_approval', createdAt: '2026-11-04T12:00:00Z', ops: [] }
const previewLlmRequest = vi.fn(async () => ({ payload: { catalog: ['original'] }, system: 'system', user: 'request', estimatedTokens: 10 }))
const runLlm = vi.fn(async (_input: LlmPreviewRequestPayload) => structuredClone(draft))
const reviewLlmChangeset = vi.fn(async () => ({ token: 'review-token', rows: [] }))
const applyReviewedLlmChangeset = vi.fn(async () => ({ status: 'stale', message: 'Данные изменились' }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  Object.defineProperty(window, 'api', { configurable: true, value: {
    previewLlmRequest, runLlm, reviewLlmChangeset, applyReviewedLlmChangeset,
    listLlmChangesets: async () => [draft], cancelLlm: async () => ({ cancelled: true })
  } })
})

describe('AI assistant lifecycle', () => {
  it('previews without calling the provider, then sends a cloneable approved request', async () => {
    const ai = useAiAssistantStore()
    const input: LlmPreviewRequestPayload = { kind: 'generate', cells: [{ zone: 'upper', method: 'mobility', count: 3 }], targetSetId: 'user-main' }
    await ai.prepare(input)
    expect(runLlm).not.toHaveBeenCalled()
    await ai.run()
    expect(runLlm).toHaveBeenCalledOnce()
    expect(structuredClone(runLlm.mock.calls[0]?.[0])).toEqual(input)
    expect(useAiAssistantStore().changeset?.id).toBe('draft')
    expect(ai.review?.token).toBe('review-token')
    expect(ai.preview).toBeNull()
  })
  it('requires another confirmation when the outbound payload changes after preview', async () => {
    const ai = useAiAssistantStore()
    await ai.prepare({ kind: 'edit', instruction: 'уточни инструкции' })
    previewLlmRequest.mockResolvedValueOnce({ payload: { catalog: ['changed'] }, system: 'system', user: 'request', estimatedTokens: 11 })
    await ai.run()
    expect(runLlm).not.toHaveBeenCalled()
    expect(ai.error).toContain('обновились')
    expect(ai.preview?.payload).toEqual({ catalog: ['changed'] })
  })
  it('refreshes a stale review without claiming that it was applied', async () => {
    const ai = useAiAssistantStore()
    ai.changeset = structuredClone(draft)
    await ai.refreshReview()
    await ai.apply()
    expect(applyReviewedLlmChangeset).toHaveBeenCalledWith({ id: 'draft', token: 'review-token' })
    expect(ai.error).toContain('изменились')
    expect(ai.status).toBe('')
    expect(ai.changeset.status).toBe('awaiting_approval')
  })
  it('preserves drafts on provider failure and handles cancellation without a new request', async () => {
    const ai = useAiAssistantStore()
    ai.changeset = structuredClone(draft)
    await ai.prepare({ kind: 'edit', instruction: 'уточни инструкции' })
    runLlm.mockRejectedValueOnce(new Error('Provider timeout'))
    await ai.run()
    expect(ai.changeset.id).toBe('draft')
    expect(ai.error).toContain('timeout')
    await ai.cancel()
    expect(ai.status).toContain('отмен')
    expect(runLlm).toHaveBeenCalledOnce()
  })
})
