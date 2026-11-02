import { LLM_MAX_EXERCISES } from '../constants/catalog-tuning'
import type { ExerciseV2, Method, Zone } from '../types/exercise-v2'
import type { ChangesetKind } from './changeset'

export const LLM_SYSTEM_PROMPT = `You design short desk-friendly micro-workouts (30–120 seconds) for a desktop app.
Reply with VALID JSON only, matching the schema. No prose, no markdown.
Rules: doable at a work desk, no pain, no equipment outside the provided list,
description <= 220 chars in the imperative with one technique cue, title <= 40 chars,
all texts in Russian. \`zones\` are load shares summing to 1.0. Do not invent ids.
Do not repeat existing titles.
Enums (ASCII ids only — do NOT emit Russian labels as method/zone values):
method ∈ mobility | strength | cardio | striking | balance
  (UI synonyms: Растяжки и йога→mobility, Силовая→strength, Лёгкая атлетика→cardio, Ударка→striking, Баланс→balance)
zone keys ∈ upper | core | lower | full
  (UI synonyms: Верх→upper, Кор и пояс→core, Низ→lower, Комплекс→full)
avoidIf ∈ neck | shoulder | wrist | lower_back | knee | ankle
posture ∈ seated | standing | floor
Numbers must be JSON numbers (not strings). For striking/cardio, context may use quiet:false and/or noSweat:false.
Timer floors: mobility/balance minSec≥20; strength/cardio/striking minSec≥30.`

export interface GenerateCell {
  zone: Zone
  method: Method
  count: number
}

/**
 * Cap generate demand so one request stays within `LLM_MAX_EXERCISES`.
 * Round-robin across cells so many thin cells still get at least one draft
 * instead of over-filling the first few and timing out the provider.
 */
export function capGenerateCells(
  cells: readonly GenerateCell[],
  maxExercises = LLM_MAX_EXERCISES
): GenerateCell[] {
  const needs = cells
    .map((cell) => ({
      zone: cell.zone,
      method: cell.method,
      count: Math.max(0, Math.floor(cell.count))
    }))
    .filter((cell) => cell.count > 0)
  const total = needs.reduce((sum, cell) => sum + cell.count, 0)
  if (total <= maxExercises) return needs

  const allocated = needs.map((cell) => ({ zone: cell.zone, method: cell.method, count: 0 }))
  let remaining = maxExercises
  let progress = true
  while (remaining > 0 && progress) {
    progress = false
    for (let index = 0; index < needs.length && remaining > 0; index++) {
      if (allocated[index]!.count < needs[index]!.count) {
        allocated[index]!.count += 1
        remaining -= 1
        progress = true
      }
    }
  }
  return allocated.filter((cell) => cell.count > 0)
}

export interface GeneratePayload {
  task: 'generate'
  cells: GenerateCell[]
  equipment: string[]
  intensityRange: [number, number]
  context: { quiet: boolean; noSweat: boolean }
  existingTitles: string[]
  examples: unknown[]
  schema: string
}

export interface EditPayload {
  task: 'edit' | 'retag' | 'tune'
  instruction?: string
  catalogDigest: { id: string; title: string; method: Method; zones: ExerciseV2['zones']; timer: ExerciseV2['timer'] }[]
  aggregates?: unknown
  schema: string
}

export function buildGeneratePayload(input: {
  cells: GenerateCell[]
  equipment: string[]
  intensityRange?: [number, number]
  quiet?: boolean
  noSweat?: boolean
  existingTitles: string[]
  examples: ExerciseV2[]
}): GeneratePayload {
  return {
    task: 'generate',
    cells: input.cells,
    equipment: [...input.equipment],
    intensityRange: input.intensityRange ?? [1, 3],
    context: {
      quiet: input.quiet !== false,
      noSweat: input.noSweat !== false
    },
    existingTitles: [...input.existingTitles],
    examples: input.examples.slice(0, 4).map((exercise) => ({
      title: exercise.title,
      description: exercise.description,
      method: exercise.method,
      zones: exercise.zones,
      intensity: exercise.intensity,
      difficulty: exercise.difficulty,
      timer: exercise.timer,
      context: exercise.context,
      emojiFallback: exercise.emojiFallback
    })),
    schema:
      'ExerciseV2 without id/source/status; method must be one of mobility|strength|cardio|striking|balance; zone keys upper|core|lower|full'
  }
}

export function buildEditPayload(input: {
  kind: Exclude<ChangesetKind, 'generate'>
  instruction?: string
  catalog: ExerciseV2[]
  aggregates?: unknown
}): EditPayload {
  return {
    task: input.kind,
    ...(input.instruction ? { instruction: input.instruction } : {}),
    catalogDigest: input.catalog.slice(0, 80).map((exercise) => ({
      id: exercise.id,
      title: exercise.title,
      method: exercise.method,
      zones: exercise.zones,
      timer: exercise.timer
    })),
    ...(input.aggregates !== undefined ? { aggregates: input.aggregates } : {}),
    schema: '{ "ops": [...] } using add, update, archive'
  }
}

/** Rough token estimate: ~4 chars per token. */
export function estimateTokens(payload: unknown): number {
  return Math.ceil(JSON.stringify(payload).length / 4)
}
