/** Field / constant explainer registry (docs/CATALOG-UI.md §3). */

export interface FieldDocAffect {
  where: string
  how: string
}

export interface FieldDoc {
  key: string
  label: string
  unit?: string
  what: string
  affects: FieldDocAffect[]
  formula?: string
  tunable?: string
}

export const FIELD_DOCS: readonly FieldDoc[] = [
  {
    key: 'zones',
    label: 'Доли нагрузки',
    unit: '0–1',
    what: 'Доли зон, куда уходит нагрузка упражнения; сумма должна быть 1.0.',
    affects: [
      { where: 'Штраф повтора (prev / today)', how: 'через overlap долей зон' },
      { where: 'Neglect', how: 'бонус задолго не тронутым зонам' },
      { where: 'Покрытие', how: 'ячейка матрицы по доминирующей зоне' },
      { where: 'Персонаж', how: 'ветка posture / power / mobility' }
    ],
    formula: 'overlap = Σ min(a_z, b_z)'
  },
  {
    key: 'method',
    label: 'Метод',
    what: 'Как прилагается нагрузка: растяжка, сила, кардио, ударка, баланс.',
    affects: [
      { where: 'Штраф метода', how: 'повтор того же метода в недавних сессиях' },
      { where: 'Профиль', how: 'уровни −/0/+/++ на оси метода' },
      { where: 'Персонаж', how: 'ветка по правилу zone×method' }
    ]
  },
  {
    key: 'intensity',
    label: 'Интенсивность',
    unit: '1–5',
    what: 'Нагрузка на тело. Не путать со сложностью техники.',
    affects: [
      { where: 'Жёсткий фильтр', how: 'intensityCap по интервалу напоминания' },
      { where: 'Severity (позже)', how: 'может влиять на строгость попапа' }
    ],
    tunable: 'INTENSITY_CAP_SHORT'
  },
  {
    key: 'difficulty',
    label: 'Сложность техники',
    unit: '1–5',
    what: 'Насколько упражнение технически сложно.',
    affects: [
      { where: 'Прогрессия', how: 'цепочка modificationOf; в V2 не входит в веса пикера' }
    ]
  },
  {
    key: 'timer.minSec',
    label: 'Таймер · минимум',
    unit: 'с',
    what: 'Нижняя граница длительности после масштабирования дозы.',
    affects: [
      { where: 'dose()', how: 'clamp результата' },
      { where: 'Валидация', how: 'пол метода' }
    ]
  },
  {
    key: 'timer.defaultSec',
    label: 'Таймер · база',
    unit: 'с',
    what: 'Базовая длительность при интервале 45 мин и scale=1.',
    affects: [{ where: 'dose()', how: 'defaultSec × scale × (interval/45)^0.35' }],
    formula: 'dose = clamp(min, max, round5(default · scale · mult))',
    tunable: 'DOSE_EXPONENT'
  },
  {
    key: 'timer.maxSec',
    label: 'Таймер · максимум',
    unit: 'с',
    what: 'Верхняя граница длительности после масштабирования.',
    affects: [{ where: 'dose()', how: 'clamp результата' }]
  },
  {
    key: 'timer.perSide',
    label: 'Таймер на сторону',
    what: 'Если true, таймер считает одну сторону (левая/правая).',
    affects: [{ where: 'Попап', how: 'формулировка «на каждую сторону»' }]
  },
  {
    key: 'reps',
    label: 'Повторения',
    what: 'Диапазон повторов; масштабируется как таймер.',
    affects: [{ where: 'doseReps()', how: 'интервал и личный scale' }]
  },
  {
    key: 'equipment',
    label: 'Инвентарь',
    what: 'Предметы, без которых упражнение не попадёт в пул.',
    affects: [{ where: 'Жёсткий фильтр', how: 'inventory.enabled + items' }]
  },
  {
    key: 'context',
    label: 'Контекст',
    what: 'Поза (сидя/стоя/пол), quiet, no-sweat.',
    affects: [{ where: 'Жёсткий фильтр', how: 'против contextPrefs пользователя' }]
  },
  {
    key: 'avoidIf',
    label: 'Ограничения',
    what: 'Теги ограничений здоровья, при которых упражнение скрывается.',
    affects: [{ where: 'Жёсткий фильтр', how: 'против settings.limitations' }]
  },
  {
    key: 'status',
    label: 'Статус',
    what: 'active или archived.',
    affects: [{ where: 'Жёсткий фильтр', how: 'архив никогда не пикается' }]
  },
  {
    key: 'source',
    label: 'Источник',
    what: 'shipped / user / llm; у LLM — batch и model.',
    affects: [
      { where: 'История', how: 'откуда пришло' },
      { where: 'Revert', how: 'откат пакета / changeset' }
    ]
  },
  {
    key: 'set',
    label: 'Набор',
    what: 'Именованный batch; можно выключить целиком.',
    affects: [{ where: 'Резолв каталога', how: 'выключенный набор не попадает в пул' }]
  },
  {
    key: 'tuning.OVERLAP_PREV_WEIGHT',
    label: 'Вес повтора (prev)',
    unit: '0–1',
    what: 'Насколько сильно режет вес пересечение с прошлым упражнением.',
    affects: [{ where: 'Фактор prev', how: 'prev = 1 − w · overlap' }],
    formula: 'prev = 1 − 0.8 · overlap',
    tunable: 'OVERLAP_PREV_WEIGHT'
  },
  {
    key: 'tuning.OVERLAP_TODAY_WEIGHT',
    label: 'Вес нагрузки сегодня',
    unit: '0–1',
    what: 'Штраф за уже сделанные сегодня зоны.',
    affects: [{ where: 'Фактор today', how: 'today = 1 − w · overlap(todayLoad)' }],
    tunable: 'OVERLAP_TODAY_WEIGHT'
  },
  {
    key: 'tuning.LEVEL_MULT',
    label: 'Множители уровней',
    what: 'Как − / 0 / + / ++ переводятся в множители профиля.',
    affects: [{ where: 'Фактор profile', how: 'взвешенное среднее LEVEL_MULT по зонам и методам' }],
    tunable: 'LEVEL_MULT'
  },
  {
    key: 'tuning.DOSE_EXPONENT',
    label: 'Показатель дозы',
    what: 'Кривизна масштаба таймера от интервала.',
    affects: [{ where: 'dose()', how: '(interval/45)^exponent' }],
    tunable: 'DOSE_EXPONENT'
  },
  {
    key: 'tuning.INTENSITY_CAP',
    label: 'Потолок интенсивности',
    what: 'Макс. intensity при коротком / среднем / длинном интервале.',
    affects: [{ where: 'Жёсткий фильтр', how: '≤20 мин → 2; <60 → 3; иначе 5' }],
    tunable: 'INTENSITY_CAP_SHORT'
  },
  {
    key: 'tuning.EFFECTIVE_POOL_WARN',
    label: 'Порог «тонкого» пула',
    unit: 'упр.',
    what: 'Inverse Simpson; ниже порога пул считается слишком узким.',
    affects: [{ where: 'Песочница / Покрытие', how: 'предупреждение и «сгенерировать»' }]
  }
]

const BY_KEY = new Map(FIELD_DOCS.map((doc) => [doc.key, doc]))

export function fieldDoc(key: string): FieldDoc | undefined {
  return BY_KEY.get(key)
}

export const EFFECTIVE_POOL_WARN_THRESHOLD = 8
