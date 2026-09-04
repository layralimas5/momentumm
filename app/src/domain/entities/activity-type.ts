import { DomainError } from '@/shared/errors'

/**
 * Eixo de evolução.
 *
 * A regra da arquitetura continua valendo: eixo novo é uma LINHA a mais, nunca
 * um módulo novo. Feed, streak, meta, hábito e objetivo leem daqui e funcionam
 * pra qualquer eixo sem código adicional.
 *
 * Quatro eixos vêm de fábrica. Os outros a pessoa cria — e é por isso que a
 * lista deixou de ser uma constante: ela é um REGISTRO, montado no início da
 * sessão com os eixos de fábrica mais os que aquela conta criou. O slug segue
 * sendo a chave, e quem não conhece um slug recebe um eixo genérico em vez de
 * uma tela quebrada.
 */

export const BUILTIN_ACTIVITY_TYPE_SLUGS = ['leitura', 'estudo', 'treino', 'meditacao'] as const

export type BuiltinActivityTypeSlug = (typeof BUILTIN_ACTIVITY_TYPE_SLUGS)[number]

/**
 * Slug de eixo. É `string` porque a lista é aberta: travar num union tornaria
 * impossível a área que a pessoa escreve.
 */
export type ActivityTypeSlug = string

/** Unidade primária do eixo. `minutos` é o denominador comum de todos. */
export type ActivityUnit = 'paginas' | 'minutos'

export interface ActivityType {
  readonly slug: ActivityTypeSlug
  readonly label: string
  /** Verbo usado no feed: "leu 32 páginas", "treinou 45 minutos". */
  readonly verb: string
  readonly unit: ActivityUnit
  readonly unitLabel: { readonly one: string; readonly many: string }
  /** Token de cor do eixo, definido em index.css, ou uma cor literal. */
  readonly colorToken: string
  /** Sugestões de registro rápido, na unidade primária do eixo. */
  readonly quickValues: readonly number[]
  /** Falso quando o eixo foi criado pela pessoa. */
  readonly builtin: boolean
}

const MINUTES_LABEL = { one: 'minuto', many: 'minutos' } as const
const PAGES_LABEL = { one: 'página', many: 'páginas' } as const

export const BUILTIN_ACTIVITY_TYPES: Readonly<Record<BuiltinActivityTypeSlug, ActivityType>> = {
  leitura: {
    slug: 'leitura',
    label: 'Leitura',
    verb: 'leu',
    unit: 'paginas',
    unitLabel: PAGES_LABEL,
    colorToken: 'var(--color-axis-leitura)',
    quickValues: [10, 20, 30, 50],
    builtin: true,
  },
  estudo: {
    slug: 'estudo',
    label: 'Estudo',
    verb: 'estudou',
    unit: 'minutos',
    unitLabel: MINUTES_LABEL,
    colorToken: 'var(--color-axis-estudo)',
    quickValues: [15, 30, 45, 60],
    builtin: true,
  },
  treino: {
    slug: 'treino',
    label: 'Treino',
    verb: 'treinou',
    unit: 'minutos',
    unitLabel: MINUTES_LABEL,
    colorToken: 'var(--color-axis-treino)',
    quickValues: [20, 30, 45, 60],
    builtin: true,
  },
  meditacao: {
    slug: 'meditacao',
    label: 'Meditação',
    verb: 'meditou',
    unit: 'minutos',
    unitLabel: MINUTES_LABEL,
    colorToken: 'var(--color-axis-meditacao)',
    quickValues: [5, 10, 15, 20],
    builtin: true,
  },
}

export const BUILTIN_ACTIVITY_TYPE_LIST: readonly ActivityType[] =
  BUILTIN_ACTIVITY_TYPE_SLUGS.map((slug) => BUILTIN_ACTIVITY_TYPES[slug])

/**
 * Cores das áreas criadas pela pessoa.
 *
 * Escolhidas pela posição de criação, não sorteadas: o eixo precisa ter sempre
 * a mesma cor, senão o gráfico da semana muda de significado a cada carga.
 */
export const CUSTOM_AXIS_COLORS: readonly string[] = [
  'var(--color-axis-custom-1)',
  'var(--color-axis-custom-2)',
  'var(--color-axis-custom-3)',
  'var(--color-axis-custom-4)',
]

export const MAX_AXIS_LABEL = 24

// ---------------------------------------------------------------------------
// registro
// ---------------------------------------------------------------------------

let customTypes: readonly ActivityType[] = []

/**
 * Carrega os eixos que a conta criou. Chamado uma vez por sessão, antes de
 * qualquer tela ler a lista.
 */
export function registerCustomActivityTypes(types: readonly ActivityType[]): void {
  customTypes = types
}

/** Todos os eixos disponíveis: os de fábrica primeiro, os criados depois. */
export function activityTypeList(): readonly ActivityType[] {
  return [...BUILTIN_ACTIVITY_TYPE_LIST, ...customTypes]
}

export function isActivityTypeSlug(value: string): boolean {
  return activityTypeList().some((type) => type.slug === value)
}

export function isBuiltinSlug(value: string): value is BuiltinActivityTypeSlug {
  return (BUILTIN_ACTIVITY_TYPE_SLUGS as readonly string[]).includes(value)
}

/**
 * O eixo de um slug.
 *
 * Slug desconhecido devolve um eixo genérico em vez de estourar: um registro
 * antigo de uma área apagada tem que continuar aparecendo no histórico, e
 * histórico que some é pior que histórico com nome feio.
 */
export function activityType(slug: ActivityTypeSlug): ActivityType {
  const found = activityTypeList().find((type) => type.slug === slug)
  return found ?? unknownType(slug)
}

function unknownType(slug: ActivityTypeSlug): ActivityType {
  return {
    slug,
    label: labelFromSlug(slug),
    verb: 'dedicou',
    unit: 'minutos',
    unitLabel: MINUTES_LABEL,
    colorToken: 'var(--color-ink-faint)',
    quickValues: [10, 20, 30, 45],
    builtin: false,
  }
}

function labelFromSlug(slug: string): string {
  const words = slug.replace(/-/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// ---------------------------------------------------------------------------
// área criada pela pessoa
// ---------------------------------------------------------------------------

export interface NewActivityTypeInput {
  readonly label: string
  /** Posição entre as áreas criadas, pra a cor ser estável. */
  readonly order: number
}

/**
 * Cria o eixo a partir do que a pessoa escreveu.
 *
 * A unidade é sempre minutos. É a única que serve pra qualquer coisa que
 * alguém queira acompanhar (escrever, tocar, cozinhar, terapia) e é o
 * denominador comum do resto do produto — perguntar "páginas ou minutos?" no
 * onboarding seria cobrar uma decisão que a pessoa ainda não tem como tomar.
 */
export function createActivityType(input: NewActivityTypeInput): ActivityType {
  const label = input.label.trim().replace(/\s+/g, ' ')

  if (label.length < 2) {
    throw new DomainError('Dá um nome à área com pelo menos 2 letras.')
  }
  if (label.length > MAX_AXIS_LABEL) {
    throw new DomainError(`O nome da área pode ter no máximo ${MAX_AXIS_LABEL} caracteres.`)
  }

  const slug = slugify(label)
  if (slug.length === 0) {
    throw new DomainError('Esse nome não vira uma área. Usa letras ou números.')
  }
  if (isBuiltinSlug(slug)) {
    throw new DomainError(`${labelFromSlug(slug)} já existe como área.`)
  }

  const color = CUSTOM_AXIS_COLORS[Math.abs(input.order) % CUSTOM_AXIS_COLORS.length]

  return {
    slug,
    label,
    verb: 'dedicou',
    unit: 'minutos',
    unitLabel: MINUTES_LABEL,
    colorToken: color ?? 'var(--color-brand)',
    quickValues: [10, 20, 30, 45],
    builtin: false,
  }
}

/** `Aulas de Violão` vira `aulas-de-violao`. Acento fora, espaço vira traço. */
export function slugify(label: string): string {
  return label
    .normalize('NFD')
    // Marcas combinantes escritas por escape: colar o caractere no fonte é o
    // tipo de coisa que um editor "arruma" sozinho e o bug some do diff.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function formatUnit(type: ActivityType, value: number): string {
  const label = value === 1 ? type.unitLabel.one : type.unitLabel.many
  return `${value} ${label}`
}
