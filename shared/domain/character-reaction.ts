import type { CharacterEmotion } from '../types/character'

export const CHARACTER_REACTION_EVENTS = ['welcome', 'ready', 'active', 'done', 'first-done', 'stage-up', 'streak', 'paused', 'skipped', 'snoozed'] as const
export type CharacterReactionEvent = typeof CHARACTER_REACTION_EVENTS[number]
export const CHARACTER_REACTION_LABELS: Record<CharacterReactionEvent, string> = {
  welcome: 'Приветствие', ready: 'Напоминание', active: 'Начало разминки', done: 'Выполнено',
  'first-done': 'Первая за день', 'stage-up': 'Новая форма', streak: 'Серия', paused: 'Пауза', skipped: 'Пропуск', snoozed: 'Отложено'
}

export type CharacterReactionTone = 'calm' | 'cheer' | 'milestone'
export type ComicVariant = 'speech' | 'burst' | 'ribbon' | 'cloud'

export interface CharacterReaction {
  caption: string
  emotion: CharacterEmotion
  tone: CharacterReactionTone
  variant: ComicVariant
  decoration: string
  animationId: string
}

interface ReactionDefinition {
  emotion: CharacterEmotion
  tone: CharacterReactionTone
  captions: readonly string[]
}

const REACTIONS: Record<CharacterReactionEvent, ReactionDefinition> = {
  welcome: {
    emotion: 'neutral', tone: 'calm',
    captions: ['ВСТАНЬ НА МИНУТУ.', 'ТЕЛУ ТОЖЕ НУЖЕН ПЕРЕРЫВ.', 'СНАЧАЛА РАЗОМНЁМСЯ?']
  },
  ready: {
    emotion: 'neutral', tone: 'calm',
    captions: ['МИНУТКА ДЛЯ СЕБЯ?', 'НАЧНЁМ, КОГДА ГОТОВ.', 'ПОРА СМЕНИТЬ ПОЗУ.']
  },
  active: {
    emotion: 'focused', tone: 'calm',
    captions: ['ЕСТЬ КОНТАКТ!', 'ДВИГАЕМСЯ В СВОЁМ ТЕМПЕ.', 'ТЕЛО В РАБОТУ!']
  },
  done: {
    emotion: 'happy', tone: 'cheer',
    captions: ['РАЗМИНКА В ЗАЧЁТ!', 'ЕСТЬ! ЕЩЁ ОДИН ШАГ.', 'ПЕРЕРЫВ УДАЛСЯ!']
  },
  'first-done': {
    emotion: 'happy', tone: 'cheer',
    captions: ['ВСТАЛ. УЖЕ ГЕРОЙ.', 'ПЕРВАЯ ЕСТЬ!', 'НАЧАЛО ПОЛОЖЕНО!']
  },
  'stage-up': {
    emotion: 'surprised', tone: 'milestone',
    captions: ['НОВАЯ ФОРМА!', 'ЭВОЛЮЦИЯ В ДЕЛЕ!', 'ВОТ ЭТО ПРОГРЕСС!']
  },
  streak: {
    emotion: 'proud', tone: 'milestone',
    captions: ['ДЕРЖИМ РИТМ!', 'ЕЩЁ ДЕНЬ В ДВИЖЕНИИ!', 'ПРИВЫЧКА НАБИРАЕТ СИЛУ!']
  },
  paused: {
    emotion: 'neutral', tone: 'calm',
    captions: ['ПАУЗА. Я РЯДОМ.', 'ПРОДОЛЖИМ В ТВОЁМ РИТМЕ.']
  },
  skipped: {
    emotion: 'neutral', tone: 'calm',
    captions: ['БЫВАЕТ. ДО СЛЕДУЮЩЕГО РАЗА.', 'КАЖДЫЙ В СВОЁМ РИТМЕ.']
  },
  snoozed: {
    emotion: 'neutral', tone: 'calm',
    captions: ['ХОРОШО, ЧЕРЕЗ ПЯТЬ МИНУТ.', 'ВЕРНЁМСЯ ЧУТЬ ПОЗЖЕ.']
  }
}

/** History seeds variation across popup windows; the previous caption prevents a repeat. */
export function characterReaction(
  event: CharacterReactionEvent,
  sequence = 0,
  previousCaption?: string
): CharacterReaction {
  const definition = REACTIONS[event]
  const safeSequence = Number.isSafeInteger(sequence) && sequence >= 0 ? sequence : 0
  let index = safeSequence % definition.captions.length
  if (definition.captions[index] === previousCaption) {
    index = (index + 1) % definition.captions.length
  }
  const variants: readonly ComicVariant[] = definition.tone === 'milestone' ? ['ribbon', 'burst']
    : definition.tone === 'cheer' ? ['burst', 'speech']
      : event === 'snoozed' || event === 'paused' ? ['cloud'] : ['speech', 'cloud']
  return {
    caption: definition.captions[index], emotion: definition.emotion, tone: definition.tone,
    variant: variants[safeSequence % variants.length]!,
    decoration: definition.tone === 'milestone' ? '✦' : definition.tone === 'cheer' ? '!' : '·',
    animationId: `${event}-${safeSequence}-${index}`
  }
}
