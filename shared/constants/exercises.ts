import type { Exercise, ExerciseDifficulty, ExerciseGroup } from '../types/exercise'

/**
 * Starter catalog for the desk-worker cycle (CONCEPT.md §7).
 * Ids are stable: sessions, levels and stats reference them.
 * Difficulty/level weighting arrives with ROADMAP #4–#5.
 */

interface CatalogEntry {
  id: string
  title: string
  description: string
  durationSec: number
  difficulty: ExerciseDifficulty
  category: string
  group: ExerciseGroup
  emojiFallback: string
  focus?: Exercise['focus']
  equipment?: string[]
}

const ENTRIES: CatalogEntry[] = [
  // Upper — neck
  {
    id: 'neck-circles',
    title: 'Круги головой',
    description: 'Медленные круги головой по часовой стрелке и против.',
    durationSec: 45,
    difficulty: 1,
    category: 'neck',
    group: 'upper',
    emojiFallback: '🧘',
    focus: ['body_belts', 'mobility']
  },
  {
    id: 'neck-tilts',
    title: 'Наклоны головы',
    description: 'Плавно наклоняйте голову к плечу и задерживайтесь на пару секунд.',
    durationSec: 40,
    difficulty: 1,
    category: 'neck',
    group: 'upper',
    emojiFallback: '🙆',
    focus: ['body_belts', 'mobility']
  },
  {
    id: 'chin-tucks',
    title: 'Втягивание подбородка',
    description: 'Прижмите подбородок к груди, затылок тянется вверх.',
    durationSec: 40,
    difficulty: 1,
    category: 'neck',
    group: 'upper',
    emojiFallback: '🐢',
    focus: ['body_belts']
  },
  // Upper — shoulders
  {
    id: 'shoulder-rolls',
    title: 'Вращения плечами',
    description: 'Круговые движения плечами назад, затем вперёд.',
    durationSec: 40,
    difficulty: 1,
    category: 'shoulders',
    group: 'upper',
    emojiFallback: '🔄',
    focus: ['body_belts']
  },
  {
    id: 'wall-slides',
    title: 'Скольжения по стене',
    description: 'Спина у стены, руки скользят вверх и вниз без отрыва.',
    durationSec: 60,
    difficulty: 2,
    category: 'shoulders',
    group: 'upper',
    emojiFallback: '🧱',
    focus: ['body_belts', 'mobility']
  },
  {
    id: 'blade-squeeze',
    title: 'Сведение лопаток',
    description: 'Сведите лопатки, задержите на пять секунд и отпустите.',
    durationSec: 40,
    difficulty: 1,
    category: 'upperBack',
    group: 'upper',
    emojiFallback: '🦅',
    focus: ['body_belts']
  },
  // Upper — chest
  {
    id: 'doorway-chest-stretch',
    title: 'Растяжка груди в проёме',
    description: 'Предплечья на косяке, шагните вперёд и раскройте грудную клетку.',
    durationSec: 45,
    difficulty: 1,
    category: 'chest',
    group: 'upper',
    emojiFallback: '🚪',
    focus: ['mobility']
  },
  {
    id: 'desk-pushups',
    title: 'Отжимания от стола',
    description: 'Опираясь на край стола, сгибайте и разгибайте руки.',
    durationSec: 45,
    difficulty: 2,
    category: 'chest',
    group: 'upper',
    emojiFallback: '💪',
    focus: ['strength']
  },
  // Upper — wrists
  {
    id: 'wrist-circles',
    title: 'Вращения запястьями',
    description: 'Спокойные круги кистями в обе стороны.',
    durationSec: 30,
    difficulty: 1,
    category: 'wrists',
    group: 'upper',
    emojiFallback: '🤲',
    focus: ['body_belts']
  },
  {
    id: 'wrist-stretch',
    title: 'Растяжка запястий',
    description: 'Пальцы одной руки мягко тянут другую кисть назад.',
    durationSec: 40,
    difficulty: 1,
    category: 'wrists',
    group: 'upper',
    emojiFallback: '✋',
    focus: ['mobility']
  },
  {
    id: 'finger-spread',
    title: 'Растяжка пальцев',
    description: 'Широко разведите пальцы и удерживайте напряжение.',
    durationSec: 30,
    difficulty: 1,
    category: 'wrists',
    group: 'upper',
    emojiFallback: '🖐️',
    focus: ['mobility']
  },
  // Lower — hips
  {
    id: 'hip-circles',
    title: 'Круги бёдрами',
    description: 'Руки на поясе, рисуйте круги тазом.',
    durationSec: 40,
    difficulty: 1,
    category: 'hips',
    group: 'lower',
    emojiFallback: '🕺',
    focus: ['mobility']
  },
  {
    id: 'hip-flexor-stretch',
    title: 'Растяжка сгибателей бедра',
    description: 'Выпад назад, таз подайте вперёд и задержитесь.',
    durationSec: 60,
    difficulty: 1,
    category: 'hips',
    group: 'lower',
    emojiFallback: '🧎',
    focus: ['mobility']
  },
  {
    id: 'glute-bridge',
    title: 'Ягодичный мостик',
    description: 'Лёжа на спине поднимайте таз и опускайте без рывков.',
    durationSec: 50,
    difficulty: 2,
    category: 'hips',
    group: 'lower',
    emojiFallback: '🌉',
    focus: ['strength']
  },
  // Lower — legs
  {
    id: 'squats',
    title: 'Приседания',
    description: 'Спина прямая, колени идут по направлению стоп.',
    durationSec: 60,
    difficulty: 2,
    category: 'legs',
    group: 'lower',
    emojiFallback: '🏋️',
    focus: ['strength', 'light_athletics']
  },
  {
    id: 'calf-raises',
    title: 'Подъёмы на носки',
    description: 'Медленно поднимайтесь на носки и опускайтесь.',
    durationSec: 45,
    difficulty: 1,
    category: 'legs',
    group: 'lower',
    emojiFallback: '🦶',
    focus: ['light_athletics']
  },
  {
    id: 'wall-sit',
    title: 'Стульчик у стены',
    description: 'Спина у стены, бёдра параллельны полу, держите положение.',
    durationSec: 45,
    difficulty: 3,
    category: 'legs',
    group: 'lower',
    emojiFallback: '🪑',
    focus: ['strength']
  },
  {
    id: 'hamstring-stretch',
    title: 'Растяжка задней поверхности бедра',
    description: 'Наклон к прямой ноге с ровной спиной.',
    durationSec: 60,
    difficulty: 1,
    category: 'legs',
    group: 'lower',
    emojiFallback: '🦵',
    focus: ['mobility']
  },
  {
    id: 'quad-stretch',
    title: 'Растяжка квадрицепса',
    description: 'Стоя отведите пятку к ягодице и удержите.',
    durationSec: 40,
    difficulty: 1,
    category: 'legs',
    group: 'lower',
    emojiFallback: '🦿',
    focus: ['mobility']
  },
  {
    id: 'single-leg-stand',
    title: 'Стойка на одной ноге',
    description: 'Держите равновесие, взгляд направлен в одну точку.',
    durationSec: 40,
    difficulty: 2,
    category: 'legs',
    group: 'lower',
    emojiFallback: '🦩',
    focus: ['balance']
  },
  // Lower — lower back
  {
    id: 'lower-back-extension',
    title: 'Прогиб стоя',
    description: 'Руки на пояснице, мягко прогнитесь назад.',
    durationSec: 40,
    difficulty: 2,
    category: 'lowerBack',
    group: 'lower',
    emojiFallback: '🧍',
    focus: ['body_belts']
  },
  {
    id: 'cat-cow-standing',
    title: 'Кошка-корова стоя',
    description: 'Округляйте и прогибайте спину в спокойном темпе.',
    durationSec: 45,
    difficulty: 1,
    category: 'lowerBack',
    group: 'lower',
    emojiFallback: '🐈',
    focus: ['mobility']
  },
  {
    id: 'good-morning',
    title: 'Наклоны со спиной прямой',
    description: 'Тяните таз назад, наклоняйтесь с ровной спиной.',
    durationSec: 50,
    difficulty: 2,
    category: 'lowerBack',
    group: 'lower',
    emojiFallback: '🌅',
    focus: ['strength']
  },
  // Full — core / whole body
  {
    id: 'plank',
    title: 'Планка',
    description: 'Локти под плечами, тело в одной линии.',
    durationSec: 40,
    difficulty: 3,
    category: 'core',
    group: 'full',
    emojiFallback: '🧘',
    focus: ['strength']
  },
  {
    id: 'side-plank',
    title: 'Боковая планка',
    description: 'Опора на предплечье, таз поднят, держите линию.',
    durationSec: 30,
    difficulty: 3,
    category: 'core',
    group: 'full',
    emojiFallback: '📐',
    focus: ['strength']
  },
  {
    id: 'torso-twists',
    title: 'Скручивания корпуса',
    description: 'Поворачивайте корпус из стороны в сторону за руками.',
    durationSec: 40,
    difficulty: 1,
    category: 'core',
    group: 'full',
    emojiFallback: '🔃',
    focus: ['mobility']
  },
  {
    id: 'bird-dog',
    title: 'Птица-собака',
    description: 'Тяните противоположные руку и ногу, спина ровная.',
    durationSec: 45,
    difficulty: 2,
    category: 'core',
    group: 'full',
    emojiFallback: '🐕',
    focus: ['strength', 'balance']
  },
  {
    id: 'march-in-place',
    title: 'Марш на месте',
    description: 'Высоко поднимайте колени, руки работают в такт.',
    durationSec: 60,
    difficulty: 1,
    category: 'fullBody',
    group: 'full',
    emojiFallback: '🚶',
    focus: ['light_athletics']
  },
  {
    id: 'jumping-jacks',
    title: 'Джампинг-джек',
    description: 'Прыжки с разведением рук и ног в спокойном темпе.',
    durationSec: 45,
    difficulty: 2,
    category: 'fullBody',
    group: 'full',
    emojiFallback: '🤸',
    focus: ['light_athletics']
  },
  // Equipment — only when the inventory layer is on and the item is owned
  {
    id: 'bag-shrugs',
    title: 'Шраги с мешком',
    description: 'Поднимайте плечи с мешком в руках, без рывков.',
    durationSec: 45,
    difficulty: 2,
    category: 'shoulders',
    group: 'upper',
    emojiFallback: '🎒',
    focus: ['strength'],
    equipment: ['bag-50']
  },
  {
    id: 'bag-carry',
    title: 'Прогулка с мешком',
    description: 'Несите мешок на плече ровным шагом.',
    durationSec: 60,
    difficulty: 2,
    category: 'fullBody',
    group: 'full',
    emojiFallback: '🚶',
    focus: ['strength'],
    equipment: ['bag-50']
  },
  {
    id: 'punch-combo',
    title: 'Серия ударов по груше',
    description: 'Прямые и боковые удары в спокойном темпе.',
    durationSec: 60,
    difficulty: 3,
    category: 'fullBody',
    group: 'full',
    emojiFallback: '🥊',
    focus: ['striking'],
    equipment: ['punching-bag']
  },
  {
    id: 'band-pull-apart',
    title: 'Разведение резинки',
    description: 'Резинка перед собой, разводите руки, сводя лопатки.',
    durationSec: 45,
    difficulty: 1,
    category: 'upperBack',
    group: 'upper',
    emojiFallback: '🎗️',
    focus: ['strength', 'body_belts'],
    equipment: ['resistance-band']
  },
  {
    id: 'dumbbell-rows',
    title: 'Тяга гантели в наклоне',
    description: 'Тяните гантель к поясу, спина остаётся ровной.',
    durationSec: 50,
    difficulty: 2,
    category: 'upperBack',
    group: 'upper',
    emojiFallback: '🏋️',
    focus: ['strength'],
    equipment: ['dumbbells']
  }
]

export const EXERCISE_CATALOG: Exercise[] = ENTRIES.map((entry) => ({ ...entry }))

/** Last-resort exercise when every candidate is filtered out. */
export const FALLBACK_EXERCISE: Exercise = EXERCISE_CATALOG[0]
