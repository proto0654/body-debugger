/**
 * Hand-retagged Catalog V2 fields for the 34 shipped exercises (CATALOG-V2 §2.1).
 * Merged into EXERCISE_CATALOG at build time; upgradeExercise prefers these values.
 */
import type { Exercise } from '../types/exercise'
import type {
  ExerciseContext,
  ExerciseTimer,
  Intensity,
  Limitation,
  Method,
  Zone
} from '../types/exercise-v2'

export type ShippedV2Tag = {
  method: Method
  zones: Partial<Record<Zone, number>>
  intensity: Intensity
  timer: ExerciseTimer
  context: ExerciseContext
  avoidIf?: Limitation[]
  perSide?: boolean
}

function timer(defaultSec: number, method: Method, perSide = false): ExerciseTimer {
  const floor = method === 'mobility' || method === 'balance' ? 20 : 30
  const minSec = Math.max(floor, Math.round((0.7 * defaultSec) / 5) * 5)
  const maxSec = Math.max(minSec, Math.round((1.5 * defaultSec) / 5) * 5)
  return {
    minSec,
    defaultSec,
    maxSec,
    ...(perSide ? { perSide: true } : {})
  }
}

const seatedQuiet: ExerciseContext = { posture: 'seated', quiet: true, noSweat: true }
const standingQuiet: ExerciseContext = { posture: 'standing', quiet: true, noSweat: true }
const floorQuiet: ExerciseContext = { posture: 'floor', quiet: true, noSweat: true }
const standingCardio: ExerciseContext = { posture: 'standing', quiet: false, noSweat: false }

export const SHIPPED_V2_TAGS: Record<string, ShippedV2Tag> = {
  'neck-circles': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(45, 'mobility'),
    context: seatedQuiet,
    avoidIf: ['neck']
  },
  'neck-tilts': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(40, 'mobility', true),
    context: seatedQuiet,
    avoidIf: ['neck'],
    perSide: true
  },
  'chin-tucks': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(40, 'mobility'),
    context: seatedQuiet,
    avoidIf: ['neck']
  },
  'shoulder-rolls': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(40, 'mobility'),
    context: seatedQuiet,
    avoidIf: ['shoulder']
  },
  'wall-slides': {
    method: 'mobility',
    zones: { upper: 0.85, core: 0.15 },
    intensity: 2,
    timer: timer(60, 'mobility'),
    context: standingQuiet,
    avoidIf: ['shoulder']
  },
  'blade-squeeze': {
    method: 'strength',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(40, 'strength'),
    context: seatedQuiet
  },
  'doorway-chest-stretch': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(45, 'mobility', true),
    context: standingQuiet,
    avoidIf: ['shoulder'],
    perSide: true
  },
  'desk-pushups': {
    method: 'strength',
    zones: { upper: 0.8, core: 0.2 },
    intensity: 2,
    timer: timer(45, 'strength'),
    context: standingQuiet,
    avoidIf: ['wrist', 'shoulder']
  },
  'wrist-circles': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(30, 'mobility'),
    context: seatedQuiet,
    avoidIf: ['wrist']
  },
  'wrist-stretch': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(40, 'mobility', true),
    context: seatedQuiet,
    avoidIf: ['wrist'],
    perSide: true
  },
  'finger-spread': {
    method: 'mobility',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(30, 'mobility'),
    context: seatedQuiet,
    avoidIf: ['wrist']
  },
  'hip-circles': {
    method: 'mobility',
    zones: { lower: 0.7, core: 0.3 },
    intensity: 1,
    timer: timer(40, 'mobility'),
    context: standingQuiet
  },
  'hip-flexor-stretch': {
    method: 'mobility',
    zones: { lower: 0.75, core: 0.25 },
    intensity: 1,
    timer: timer(60, 'mobility', true),
    context: standingQuiet,
    perSide: true
  },
  'glute-bridge': {
    method: 'strength',
    zones: { lower: 0.7, core: 0.3 },
    intensity: 2,
    timer: timer(50, 'strength'),
    context: floorQuiet,
    avoidIf: ['lower_back']
  },
  squats: {
    method: 'strength',
    zones: { lower: 0.85, core: 0.15 },
    intensity: 2,
    timer: timer(60, 'strength'),
    context: standingQuiet,
    avoidIf: ['knee']
  },
  'calf-raises': {
    method: 'cardio',
    zones: { lower: 1 },
    intensity: 1,
    timer: timer(45, 'cardio'),
    context: standingQuiet,
    avoidIf: ['ankle']
  },
  'wall-sit': {
    method: 'strength',
    zones: { lower: 0.9, core: 0.1 },
    intensity: 3,
    timer: timer(45, 'strength'),
    context: standingQuiet,
    avoidIf: ['knee']
  },
  'hamstring-stretch': {
    method: 'mobility',
    zones: { lower: 1 },
    intensity: 1,
    timer: timer(60, 'mobility', true),
    context: standingQuiet,
    perSide: true
  },
  'quad-stretch': {
    method: 'mobility',
    zones: { lower: 1 },
    intensity: 1,
    timer: timer(40, 'mobility', true),
    context: standingQuiet,
    avoidIf: ['knee'],
    perSide: true
  },
  'single-leg-stand': {
    method: 'balance',
    zones: { lower: 0.8, core: 0.2 },
    intensity: 2,
    timer: timer(40, 'balance', true),
    context: standingQuiet,
    avoidIf: ['ankle'],
    perSide: true
  },
  'lower-back-extension': {
    method: 'mobility',
    zones: { core: 0.75, lower: 0.25 },
    intensity: 2,
    timer: timer(40, 'mobility'),
    context: standingQuiet,
    avoidIf: ['lower_back']
  },
  'cat-cow-standing': {
    method: 'mobility',
    zones: { core: 0.7, upper: 0.3 },
    intensity: 1,
    timer: timer(45, 'mobility'),
    context: standingQuiet,
    avoidIf: ['lower_back']
  },
  'good-morning': {
    method: 'strength',
    zones: { core: 0.55, lower: 0.45 },
    intensity: 2,
    timer: timer(50, 'strength'),
    context: standingQuiet,
    avoidIf: ['lower_back']
  },
  plank: {
    method: 'strength',
    zones: { core: 1 },
    intensity: 3,
    timer: timer(40, 'strength'),
    context: floorQuiet,
    avoidIf: ['lower_back', 'wrist']
  },
  'side-plank': {
    method: 'strength',
    zones: { core: 0.85, lower: 0.15 },
    intensity: 3,
    timer: timer(30, 'strength', true),
    context: floorQuiet,
    avoidIf: ['lower_back', 'shoulder'],
    perSide: true
  },
  'torso-twists': {
    method: 'mobility',
    zones: { core: 0.8, upper: 0.2 },
    intensity: 1,
    timer: timer(40, 'mobility'),
    context: seatedQuiet
  },
  'bird-dog': {
    method: 'strength',
    zones: { core: 0.65, lower: 0.2, upper: 0.15 },
    intensity: 2,
    timer: timer(45, 'strength', true),
    context: floorQuiet,
    avoidIf: ['lower_back', 'wrist'],
    perSide: true
  },
  'march-in-place': {
    method: 'cardio',
    zones: { full: 0.6, lower: 0.4 },
    intensity: 1,
    timer: timer(60, 'cardio'),
    context: standingQuiet
  },
  'jumping-jacks': {
    method: 'cardio',
    zones: { full: 1 },
    intensity: 2,
    timer: timer(45, 'cardio'),
    context: standingCardio
  },
  'bag-shrugs': {
    method: 'strength',
    zones: { upper: 1 },
    intensity: 2,
    timer: timer(45, 'strength'),
    context: standingQuiet,
    avoidIf: ['shoulder', 'neck']
  },
  'bag-carry': {
    method: 'strength',
    zones: { full: 0.5, core: 0.3, lower: 0.2 },
    intensity: 2,
    timer: timer(60, 'strength'),
    context: standingQuiet,
    avoidIf: ['lower_back', 'shoulder']
  },
  'punch-combo': {
    method: 'striking',
    zones: { upper: 0.55, core: 0.25, full: 0.2 },
    intensity: 3,
    timer: timer(60, 'striking'),
    context: standingCardio,
    avoidIf: ['shoulder', 'wrist']
  },
  'band-pull-apart': {
    method: 'strength',
    zones: { upper: 1 },
    intensity: 1,
    timer: timer(45, 'strength'),
    context: standingQuiet,
    avoidIf: ['shoulder']
  },
  'dumbbell-rows': {
    method: 'strength',
    zones: { upper: 0.85, core: 0.15 },
    intensity: 2,
    timer: timer(50, 'strength', true),
    context: standingQuiet,
    avoidIf: ['lower_back', 'shoulder'],
    perSide: true
  }
}

export function applyShippedV2Tags(entry: Exercise): Exercise {
  const tag = SHIPPED_V2_TAGS[entry.id]
  if (!tag) return entry
  return {
    ...entry,
    method: tag.method,
    zones: { ...tag.zones },
    intensity: tag.intensity,
    timer: { ...tag.timer },
    context: { ...tag.context },
    ...(tag.avoidIf ? { avoidIf: [...tag.avoidIf] } : {}),
    ...(tag.perSide || tag.timer.perSide ? { perSide: true } : {})
  }
}
