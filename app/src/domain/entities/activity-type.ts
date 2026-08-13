/**
 * Eixo de evolução. Adicionar um eixo novo é adicionar uma entrada aqui,
 * nunca um módulo novo no app. Feed, streak, meta e ranking leem daqui.
 */
export const ACTIVITY_TYPE_SLUGS = ['leitura', 'estudo', 'treino', 'meditacao'] as const

export type ActivityTypeSlug = (typeof ACTIVITY_TYPE_SLUGS)[number]

/** Unidade primária do eixo. `minutos` é o denominador comum de todos. */
export type ActivityUnit = 'paginas' | 'minutos'

export interface ActivityType {
  readonly slug: ActivityTypeSlug
  readonly label: string
  /** Verbo usado no feed: "leu 32 páginas", "treinou 45 minutos". */
  readonly verb: string
  readonly unit: ActivityUnit
  readonly unitLabel: { readonly one: string; readonly many: string }
  /** Token de cor do eixo, definido em index.css. */
  readonly colorToken: string
  /** Sugestões de registro rápido, na unidade primária do eixo. */
  readonly quickValues: readonly number[]
}

export const ACTIVITY_TYPES: Readonly<Record<ActivityTypeSlug, ActivityType>> = {
  leitura: {
    slug: 'leitura',
    label: 'Leitura',
    verb: 'leu',
    unit: 'paginas',
    unitLabel: { one: 'página', many: 'páginas' },
    colorToken: 'var(--color-axis-leitura)',
    quickValues: [10, 20, 30, 50],
  },
  estudo: {
    slug: 'estudo',
    label: 'Estudo',
    verb: 'estudou',
    unit: 'minutos',
    unitLabel: { one: 'minuto', many: 'minutos' },
    colorToken: 'var(--color-axis-estudo)',
    quickValues: [15, 30, 45, 60],
  },
  treino: {
    slug: 'treino',
    label: 'Treino',
    verb: 'treinou',
    unit: 'minutos',
    unitLabel: { one: 'minuto', many: 'minutos' },
    colorToken: 'var(--color-axis-treino)',
    quickValues: [20, 30, 45, 60],
  },
  meditacao: {
    slug: 'meditacao',
    label: 'Meditação',
    verb: 'meditou',
    unit: 'minutos',
    unitLabel: { one: 'minuto', many: 'minutos' },
    colorToken: 'var(--color-axis-meditacao)',
    quickValues: [5, 10, 15, 20],
  },
}

export const ACTIVITY_TYPE_LIST: readonly ActivityType[] = ACTIVITY_TYPE_SLUGS.map(
  (slug) => ACTIVITY_TYPES[slug],
)

export function isActivityTypeSlug(value: string): value is ActivityTypeSlug {
  return (ACTIVITY_TYPE_SLUGS as readonly string[]).includes(value)
}

export function activityType(slug: ActivityTypeSlug): ActivityType {
  return ACTIVITY_TYPES[slug]
}

export function formatUnit(type: ActivityType, value: number): string {
  const label = value === 1 ? type.unitLabel.one : type.unitLabel.many
  return `${value} ${label}`
}
