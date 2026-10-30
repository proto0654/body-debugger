import type { CharacterBranch, CharacterBuild, CharacterStage } from '../types/character'

export const CHARACTER_STAGE_KEYS: Record<CharacterStage, string> = {
  0: 'start',
  1: 'awake',
  2: 'moving',
  3: 'steady',
  4: 'strong',
  5: 'peak'
}

export const CHARACTER_STAGE_LABELS: Record<CharacterStage, string> = {
  0: 'Скуф',
  1: 'Проснулся',
  2: 'Разминается',
  3: 'В тонусе',
  4: 'Крепкий',
  5: 'Desk Hulk'
}

export const CHARACTER_BRANCH_LABELS: Record<CharacterBranch, string> = {
  neutral: 'Баланс',
  posture: 'Осанка',
  power: 'Сила',
  mobility: 'Подвижность'
}

export const CHARACTER_BRANCHES: CharacterBranch[] = [
  'neutral',
  'posture',
  'power',
  'mobility'
]

export const CHARACTER_BUILDS: CharacterBuild[] = [
  'lean',
  'average',
  'stocky',
  'neutral'
]

export const CHARACTER_BUILD_LABELS: Record<CharacterBuild, string> = {
  lean: 'Худой',
  average: 'Обычный',
  stocky: 'Плотный',
  neutral: 'Не выбран'
}

export const DEFAULT_CHARACTER_PACK = 'desk-hulk'
