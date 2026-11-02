import type { ExerciseV2, Method, Zone } from '../types/exercise-v2'
import type { ChangesetKind } from './changeset'

export const LLM_SYSTEM_PROMPT = `You design short desk-friendly micro-workouts (30–120 seconds) for a desktop app.
Reply with VALID JSON only, matching the schema. No prose, no markdown.
Rules: doable at a work desk, no pain, no equipment outside the provided list,
description <= 220 chars in the imperative with one technique cue, title <= 40 chars,
all texts in Russian. \`zones\` are load shares summing to 1.0. Do not invent ids.
Do not repeat existing titles.`

export interface GenerateCell {
  zone: Zone
  method: Method
  count: number
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
    schema: 'ExerciseV2 without id, source, status'
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
