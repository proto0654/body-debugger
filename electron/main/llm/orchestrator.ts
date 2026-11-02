import { randomUUID } from 'node:crypto'
import type { GenerateCell } from '../../../shared/domain/llm-prompt'
import {
  LLM_SYSTEM_PROMPT,
  buildEditPayload,
  buildGeneratePayload,
  estimateTokens
} from '../../../shared/domain/llm-prompt'
import {
  flagDuplicates,
  parseGenerateExercises,
  parseOpsPayload
} from '../../../shared/domain/llm-parse'
import {
  applyOps,
  forkShipped,
  summarize,
  validateTuneTimerPatch,
  type CatalogOp,
  type CatalogState,
  type Changeset,
  type ChangesetKind,
  type OpRecord
} from '../../../shared/domain/changeset'
import {
  shippedCatalogV2,
  USER_MAIN_BATCH_ID
} from '../../../shared/domain/catalog'
import type { ExerciseV2, LlmSettings } from '../../../shared/types/exercise-v2'
import { LLM_MAX_EXERCISES, LLM_MAX_OPS } from '../../../shared/constants/catalog-tuning'
import {
  allocateExerciseId,
  applyExercises,
  getCatalogFile,
  getChangeset,
  getResolvedCatalogV2,
  listChangesets,
  renameBatch,
  saveChangeset,
  setBatchEnabled,
  setExerciseStatus,
  upsertBatch
} from '../catalog-store'
import { getSettings, updateSettings } from '../persistence'
import { readKey, hasKey } from './secrets'
import { chatCompletion } from './provider'

export interface PreviewResult {
  system: string
  user: string
  payload: unknown
  estimatedTokens: number
}

export interface RunInput {
  kind: ChangesetKind
  targetSetId?: string
  cells?: GenerateCell[]
  instruction?: string
  aggregates?: unknown
}

let activeAbort: AbortController | null = null
let activeChangesetId: string | null = null

function catalogContext(): {
  catalog: ExerciseV2[]
  existingTitles: string[]
  examples: ExerciseV2[]
  equipment: string[]
} {
  const settings = getSettings()
  const file = getCatalogFile()
  const resolved = getResolvedCatalogV2()
  const equipment =
    settings.inventory.enabled && settings.inventory.items.length
      ? [...settings.inventory.items]
      : []
  return {
    catalog: file.exercises.filter((exercise) => exercise.status === 'active'),
    existingTitles: resolved.map((exercise) => exercise.title),
    examples: resolved.slice(0, 4),
    equipment
  }
}

function previewPayload(input: RunInput): PreviewResult {
  const ctx = catalogContext()
  let payload: unknown
  if (input.kind === 'generate') {
    payload = buildGeneratePayload({
      cells: input.cells ?? [],
      equipment: ctx.equipment,
      existingTitles: ctx.existingTitles,
      examples: ctx.examples
    })
  } else {
    payload = buildEditPayload({
      kind: input.kind,
      instruction: input.instruction,
      catalog: ctx.catalog,
      aggregates: input.aggregates
    })
  }
  const user = JSON.stringify(payload)
  return {
    system: LLM_SYSTEM_PROMPT,
    user,
    payload,
    estimatedTokens: estimateTokens({ system: LLM_SYSTEM_PROMPT, user })
  }
}

export function previewGenerate(cells: GenerateCell[]): PreviewResult {
  return previewPayload({ kind: 'generate', cells })
}

export function previewEdit(instruction: string, kind: Exclude<ChangesetKind, 'generate'> = 'edit'): PreviewResult {
  return previewPayload({ kind, instruction })
}

export function previewTune(aggregates: unknown): PreviewResult {
  return previewPayload({ kind: 'tune', aggregates })
}

export function previewRequest(input: RunInput): PreviewResult {
  return previewPayload(input)
}

function canCallNetwork(settings: LlmSettings): boolean {
  if (!settings.enabled) return false
  if (settings.baseUrl === 'mock://local') return true
  return hasKey()
}

function mockCompletion(input: RunInput): string {
  const ctx = catalogContext()
  if (input.kind === 'generate') {
    const cells = input.cells ?? []
    const exercises = cells.flatMap((cell, cellIndex) =>
      Array.from({ length: Math.min(cell.count, LLM_MAX_EXERCISES) }, (_, index) => ({
        title: `Mock ${cell.zone} ${cell.method} ${cellIndex + 1}.${index + 1}`.slice(0, 40),
        description: `Сделай короткое упражнение для ${cell.zone}, держи спину ровно.`,
        method: cell.method,
        zones: { [cell.zone]: 1 },
        intensity: 2,
        difficulty: 2,
        timer: { minSec: 25, defaultSec: 35, maxSec: 45 },
        context: { posture: 'standing', quiet: true, noSweat: true },
        emojiFallback: '💪'
      }))
    )
    return JSON.stringify({ exercises: exercises.slice(0, LLM_MAX_EXERCISES) })
  }

  const target = ctx.catalog[0]
  if (!target) {
    return JSON.stringify({ ops: [] })
  }
  if (input.kind === 'tune') {
    return JSON.stringify({
      ops: [
        {
          op: 'update',
          id: target.id,
          patch: { timer: { ...target.timer, defaultSec: target.timer.defaultSec + 5 } }
        }
      ]
    })
  }
  return JSON.stringify({
    ops: [
      {
        op: 'update',
        id: target.id,
        patch: { description: `${target.description} (mock edit)` }
      }
    ]
  })
}

function parseResponse(kind: ChangesetKind, raw: string, existing: ExerciseV2[]): OpRecord[] {
  const ops = kind === 'generate' ? parseGenerateExercises(raw) : parseOpsPayload(raw)
  const capped = ops.slice(0, kind === 'generate' ? LLM_MAX_EXERCISES : LLM_MAX_OPS)
  let records = flagDuplicates(capped, existing)
  if (kind === 'tune') {
    records = records.map((record) => {
      if (record.op.op !== 'update' || record.state === 'rejected') return record
      const updateOp = record.op
      const current = existing.find((exercise) => exercise.id === updateOp.id)
      if (!current) return record
      const issue = validateTuneTimerPatch(current, record.op.patch)
      if (!issue) return record
      return { ...record, state: 'rejected' as const, enabled: false, issues: [...record.issues, issue] }
    })
  }
  return records
}

function newChangeset(input: RunInput): Changeset {
  return {
    id: randomUUID(),
    status: 'generating',
    createdAt: new Date().toISOString(),
    kind: input.kind,
    targetSetId: input.targetSetId ?? USER_MAIN_BATCH_ID,
    ops: []
  }
}

let broadcastHook: ((changeset: Changeset) => void) | null = null

export function setLlmChangedHook(handler: (changeset: Changeset) => void): void {
  broadcastHook = handler
}

function emitChangeset(changeset: Changeset): void {
  saveChangeset(changeset)
  broadcastHook?.(changeset)
}

async function completeRun(input: RunInput): Promise<Changeset> {
  const settings = getSettings()
  if (!canCallNetwork(settings.llm)) {
    throw new Error('LLM is disabled or API key is missing')
  }

  const preview = previewPayload(input)
  const changeset = newChangeset(input)
  activeChangesetId = changeset.id
  activeAbort = new AbortController()
  emitChangeset(changeset)

  try {
    let raw: string
    let usage: Changeset['usage']

    if (settings.llm.baseUrl === 'mock://local') {
      raw = mockCompletion(input)
      usage = { promptTokens: preview.estimatedTokens, completionTokens: 128 }
    } else {
      const apiKey = readKey()
      if (!apiKey) throw new Error('API key is missing')
      const result = await chatCompletion({
        baseUrl: settings.llm.baseUrl,
        model: settings.llm.model,
        apiKey,
        system: preview.system,
        user: preview.user,
        signal: activeAbort.signal
      })
      raw = result.content
      usage = result.usage
    }

    const ctx = catalogContext()
    const ops = parseResponse(input.kind, raw, [...ctx.catalog, ...shippedCatalogV2()])
    const parsed: Changeset = {
      ...changeset,
      status: 'awaiting_approval',
      ops,
      usage
    }
    emitChangeset(parsed)
    return parsed
  } catch (error) {
    const failed: Changeset = {
      ...changeset,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    }
    emitChangeset(failed)
    throw error
  } finally {
    activeAbort = null
    activeChangesetId = null
  }
}

export function runGenerate(cells: GenerateCell[], targetSetId?: string): Promise<Changeset> {
  return completeRun({ kind: 'generate', cells, targetSetId })
}

export function runEdit(
  instruction: string,
  kind: Exclude<ChangesetKind, 'generate'> = 'edit',
  targetSetId?: string
): Promise<Changeset> {
  return completeRun({ kind, instruction, targetSetId })
}

export function runTune(aggregates: unknown, targetSetId?: string): Promise<Changeset> {
  if (!getSettings().llm.shareProgress && getSettings().llm.baseUrl !== 'mock://local') {
    throw new Error('shareProgress must be enabled for tune requests')
  }
  return completeRun({ kind: 'tune', aggregates, targetSetId })
}

export function runRequest(input: RunInput): Promise<Changeset> {
  if (input.kind === 'tune' && !getSettings().llm.shareProgress && getSettings().llm.baseUrl !== 'mock://local') {
    throw new Error('shareProgress must be enabled for tune requests')
  }
  return completeRun(input)
}

export function cancelRun(): boolean {
  if (!activeAbort) return false
  activeAbort.abort()
  return true
}

export function getChangesetById(id: string): Changeset | null {
  return getChangeset(id)
}

export function listStoredChangesets(): Changeset[] {
  return listChangesets()
}

export function toggleOp(changesetId: string, index: number, enabled?: boolean): Changeset | null {
  const current = getChangeset(changesetId)
  if (!current || current.status !== 'awaiting_approval') return null
  if (index < 0 || index >= current.ops.length) return null
  const ops = current.ops.map((record, i) => {
    if (i !== index) return record
    if (record.state === 'rejected') return record
    const nextEnabled = enabled ?? !record.enabled
    return { ...record, enabled: nextEnabled }
  })
  const updated: Changeset = { ...current, ops }
  emitChangeset(updated)
  return updated
}

function catalogStateFromStore(): CatalogState {
  const settings = getSettings()
  return {
    exercises: getCatalogFile().exercises,
    profileShifts: settings.profileShifts.map((shift) => ({ ...shift }))
  }
}

function expandShippedUpdates(ops: CatalogOp[], targetSetId: string): CatalogOp[] {
  const shipped = shippedCatalogV2()
  const shippedIds = new Set(shipped.map((exercise) => exercise.id))
  const expanded: CatalogOp[] = []

  for (const op of ops) {
    if (op.op !== 'update' || !shippedIds.has(op.id)) {
      expanded.push(op)
      continue
    }
    const base = shipped.find((exercise) => exercise.id === op.id)
    if (!base) continue
    const forkId = allocateExerciseId(targetSetId, base.title)
    const forked = forkShipped(base, op.patch, forkId, targetSetId)
    const { id: _id, source: _source, status: _status, ...exercise } = forked
    expanded.push({ op: 'add', exercise })
  }
  return expanded
}

export function applyChangeset(changesetId: string): Changeset | null {
  const current = getChangeset(changesetId)
  if (!current || current.status !== 'awaiting_approval') return null

  const enabledOps = current.ops
    .filter((record) => record.enabled && record.state !== 'rejected')
    .map((record) => record.op)

  if (enabledOps.length === 0) return null

  const targetSetId = current.targetSetId ?? USER_MAIN_BATCH_ID
  const before = catalogStateFromStore()
  const shippedIds = new Set(shippedCatalogV2().map((exercise) => exercise.id))
  const ops = expandShippedUpdates(enabledOps, targetSetId)

  const { state, assignedIds, inverse } = applyOps(before, ops, {
    changesetId: current.id,
    targetSetId,
    shippedIds,
    allocateId: (draft) => allocateExerciseId(targetSetId, draft.title),
    model: getSettings().llm.model
  })

  applyExercises(state.exercises)

  if (current.kind === 'generate' && assignedIds.length > 0) {
    const batchId = targetSetId
    const existing = getCatalogFile().batches.find((batch) => batch.id === batchId)
    upsertBatch({
      id: batchId,
      name: existing?.name ?? 'LLM batch',
      kind: existing?.kind === 'user' ? 'llm' : (existing?.kind ?? 'llm'),
      createdAt: existing?.createdAt ?? current.createdAt,
      enabled: existing?.enabled ?? true,
      model: getSettings().llm.model,
      count: state.exercises.filter(
        (exercise) => exercise.source.batchId === batchId && exercise.status === 'active'
      ).length
    })
  }

  const settings = getSettings()
  updateSettings({
    ...settings,
    profileShifts: state.profileShifts
  })

  const applied: Changeset = {
    ...current,
    status: 'applied',
    inverse
  }
  emitChangeset(applied)
  return applied
}

export function discardChangeset(changesetId: string): Changeset | null {
  const current = getChangeset(changesetId)
  if (!current || (current.status !== 'awaiting_approval' && current.status !== 'failed')) return null
  const updated: Changeset = { ...current, status: 'discarded' }
  emitChangeset(updated)
  return updated
}

export function revertChangeset(changesetId: string): Changeset | null {
  const current = getChangeset(changesetId)
  if (!current || current.status !== 'applied' || !current.inverse?.length) return null

  const before = catalogStateFromStore()
  const targetSetId = current.targetSetId ?? USER_MAIN_BATCH_ID
  const shippedIds = new Set(shippedCatalogV2().map((exercise) => exercise.id))
  const { state } = applyOps(before, current.inverse, {
    changesetId: `${current.id}-revert`,
    targetSetId,
    shippedIds,
    allocateId: (draft) => allocateExerciseId(targetSetId, draft.title)
  })

  applyExercises(state.exercises)
  updateSettings({
    ...getSettings(),
    profileShifts: state.profileShifts
  })

  const reverted: Changeset = { ...current, status: 'reverted' }
  emitChangeset(reverted)
  return reverted
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const settings = getSettings()
  if (!settings.llm.enabled) return { ok: false, message: 'LLM is disabled' }
  if (settings.llm.baseUrl === 'mock://local') return { ok: true, message: 'Mock provider ready' }
  if (!hasKey()) return { ok: false, message: 'API key is missing' }

  try {
    const apiKey = readKey()
    if (!apiKey) return { ok: false, message: 'API key is missing' }
    await chatCompletion({
      baseUrl: settings.llm.baseUrl,
      model: settings.llm.model,
      apiKey,
      system: 'Reply with JSON: {"pong":true}',
      user: '{"ping":true}'
    })
    return { ok: true, message: 'Connection OK' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export function saveLlmConfig(patch: Partial<LlmSettings>): LlmSettings {
  const settings = getSettings()
  const llm: LlmSettings = {
    ...settings.llm,
    ...patch,
    enabled: patch.enabled ?? settings.llm.enabled,
    baseUrl:
      typeof patch.baseUrl === 'string' && patch.baseUrl.trim()
        ? patch.baseUrl.trim()
        : settings.llm.baseUrl,
    model:
      typeof patch.model === 'string' && patch.model.trim() ? patch.model.trim() : settings.llm.model,
    shareProgress: patch.shareProgress ?? settings.llm.shareProgress
  }
  updateSettings({ ...settings, llm })
  return llm
}

export function getLlmConfig(): { llm: LlmSettings; hasKey: boolean } {
  const settings = getSettings()
  return { llm: { ...settings.llm }, hasKey: hasKey() }
}

export function summarizeChangeset(changeset: Changeset): ReturnType<typeof summarize> {
  return summarize(changeset)
}

export function setCatalogExerciseStatus(id: string, status: 'active' | 'archived'): boolean {
  return setExerciseStatus(id, status)
}

export function setCatalogBatchEnabled(id: string, enabled: boolean): boolean {
  return setBatchEnabled(id, enabled)
}

export function renameCatalogBatch(id: string, name: string): boolean {
  return renameBatch(id, name)
}

export function getCatalogSnapshot(): ReturnType<typeof getCatalogFile> {
  return getCatalogFile()
}

export { activeChangesetId }
