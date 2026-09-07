import type { JourneyEventType } from '@/domain/entities/journey-event'

/**
 * O contrato do card compartilhável.
 *
 * `ShareCardData` é a fronteira entre "o que aconteceu" e "o que aparece na
 * imagem". Nenhum template conhece hábito, objetivo, etapa ou momentum: eles
 * recebem título, métrica e lista já resolvidos. É o que permite ter cinco
 * templates sem cinco cópias da mesma regra — e trocar a origem do dado
 * (evento salvo hoje, item de feed amanhã) sem tocar em desenho.
 */

// ---------------------------------------------------------------------------
// formato
// ---------------------------------------------------------------------------

export const SHARE_FORMATS = ['stories', 'post', 'square'] as const
export type ShareFormat = (typeof SHARE_FORMATS)[number]

export interface ShareFormatSpec {
  readonly id: ShareFormat
  readonly label: string
  readonly ratio: string
  readonly width: number
  readonly height: number
}

/**
 * 1080 de largura nos três: é o lado curto que as redes usam como referência,
 * e subir além disso engorda o arquivo sem ganhar nitidez em tela de celular.
 */
export const SHARE_FORMAT_SPECS: Readonly<Record<ShareFormat, ShareFormatSpec>> = {
  stories: { id: 'stories', label: 'Stories', ratio: '9:16', width: 1080, height: 1920 },
  post: { id: 'post', label: 'Post', ratio: '4:5', width: 1080, height: 1350 },
  square: { id: 'square', label: 'Quadrado', ratio: '1:1', width: 1080, height: 1080 },
}

export const DEFAULT_SHARE_FORMAT: ShareFormat = 'stories'

// ---------------------------------------------------------------------------
// template
// ---------------------------------------------------------------------------

export const SHARE_TEMPLATES = ['dark', 'light', 'gradient', 'minimal', 'transparent'] as const
export type ShareTemplateId = (typeof SHARE_TEMPLATES)[number]

export interface ShareTemplateSpec {
  readonly id: ShareTemplateId
  readonly label: string
  readonly hint: string
  /** Sem fundo: exporta PNG com alpha pra ir por cima de uma foto da pessoa. */
  readonly transparent: boolean
}

export const SHARE_TEMPLATE_SPECS: Readonly<Record<ShareTemplateId, ShareTemplateSpec>> = {
  dark: { id: 'dark', label: 'Dark', hint: 'A identidade do app', transparent: false },
  light: { id: 'light', label: 'Light', hint: 'Fundo claro, muito ar', transparent: false },
  gradient: { id: 'gradient', label: 'Gradient', hint: 'Violeta discreto', transparent: false },
  minimal: { id: 'minimal', label: 'Minimal', hint: 'Só o essencial', transparent: false },
  transparent: {
    id: 'transparent',
    label: 'Transparent',
    hint: 'PNG sem fundo, pra sua foto',
    transparent: true,
  },
}

export const DEFAULT_SHARE_TEMPLATE: ShareTemplateId = 'dark'

// ---------------------------------------------------------------------------
// o que aparece no card
// ---------------------------------------------------------------------------

export const SHARE_FIELDS = [
  'momentum',
  'items',
  'completion',
  'objective',
  'duration',
  'date',
  'username',
  'note',
  'branding',
] as const

export type ShareField = (typeof SHARE_FIELDS)[number]

export type ShareFieldSet = Readonly<Record<ShareField, boolean>>

export interface ShareFieldSpec {
  readonly id: ShareField
  readonly label: string
  /** Por que ligar isso expõe alguma coisa. Vazio quando não expõe nada. */
  readonly warning: string | null
}

export const SHARE_FIELD_SPECS: Readonly<Record<ShareField, ShareFieldSpec>> = {
  momentum: { id: 'momentum', label: 'Momentum Score', warning: null },
  items: {
    id: 'items',
    label: 'Atividades concluídas',
    warning: 'Mostra o nome de cada hábito da rotina.',
  },
  completion: { id: 'completion', label: 'Percentual de execução', warning: null },
  objective: {
    id: 'objective',
    label: 'Nome do objetivo ou desafio',
    warning: 'O título que você escreveu aparece na imagem.',
  },
  duration: { id: 'duration', label: 'Duração', warning: null },
  note: { id: 'note', label: 'Frase do Momentumm', warning: null },
  date: { id: 'date', label: 'Data', warning: null },
  username: { id: 'username', label: 'Seu nome', warning: 'Identifica você na imagem.' },
  branding: { id: 'branding', label: 'Assinatura Momentumm', warning: null },
}

/**
 * Quais campos fazem sentido em cada tipo de evento.
 *
 * Um toggle que não muda nada é pior que toggle nenhum: a pessoa liga, não vê
 * diferença e para de confiar nos outros. Duração não existe em progresso de
 * objetivo; lista não existe em momentum.
 */
const FIELDS_BY_TYPE: Readonly<Record<JourneyEventType, readonly ShareField[]>> = {
  habit_completed: ['momentum', 'completion', 'objective', 'duration', 'date', 'username', 'note', 'branding'],
  routine_completed: ['momentum', 'items', 'completion', 'duration', 'date', 'username', 'note', 'branding'],
  day_completed: ['momentum', 'items', 'completion', 'duration', 'date', 'username', 'note', 'branding'],
  goal_progress: ['momentum', 'completion', 'objective', 'date', 'username', 'note', 'branding'],
  goal_completed: ['momentum', 'completion', 'objective', 'date', 'username', 'note', 'branding'],
  milestone: ['momentum', 'date', 'username', 'note', 'branding'],
  weekly_review: ['momentum', 'items', 'completion', 'duration', 'date', 'username', 'note', 'branding'],
  comeback: ['momentum', 'date', 'username', 'note', 'branding'],
  momentum_record: ['momentum', 'date', 'username', 'note', 'branding'],
  challenge_joined: ['momentum', 'objective', 'date', 'username', 'note', 'branding'],
  challenge_progress: ['momentum', 'completion', 'objective', 'date', 'username', 'note', 'branding'],
  challenge_milestone: ['momentum', 'completion', 'objective', 'date', 'username', 'note', 'branding'],
  challenge_completed: ['momentum', 'completion', 'objective', 'date', 'username', 'note', 'branding'],
}

export function availableFieldsFor(type: JourneyEventType): readonly ShareField[] {
  return FIELDS_BY_TYPE[type]
}

export function supportsField(type: JourneyEventType, field: ShareField): boolean {
  return FIELDS_BY_TYPE[type].includes(field)
}

/**
 * O estado inicial dos toggles: MENOR EXPOSIÇÃO e MENOS COISA NA TELA.
 *
 * Duas regras se somam aqui.
 *
 * Privacidade: nome do objetivo, lista de hábitos e nome da pessoa começam
 * desligados. São os três campos que carregam conteúdo escrito por ela — "Sair
 * da terapia", "Remédio 8h", o nome completo — e nenhum deles deveria ir pro
 * Instagram por omissão.
 *
 * Estética: a frase do app ("Você avançou hoje.") também começa desligada. Ela
 * é a coisa mais "de aplicativo" do card, e o card que a pessoa quer postar é o
 * que parece dela — não o print de um dashboard. Quem quiser, liga.
 *
 * Número e percentual começam ligados: são o motivo do card existir e não dizem
 * nada sobre a vida de ninguém.
 */
export function defaultFieldsFor(type: JourneyEventType): ShareFieldSet {
  const available = FIELDS_BY_TYPE[type]
  const on = (field: ShareField, value: boolean) => available.includes(field) && value

  return {
    momentum: on('momentum', true),
    completion: on('completion', true),
    duration: on('duration', true),
    date: on('date', true),
    branding: on('branding', true),
    items: on('items', false),
    objective: on('objective', false),
    username: on('username', false),
    note: on('note', false),
  }
}

/** Garante que um conjunto vindo de fora não liga campo que o tipo não tem. */
export function sanitizeFields(type: JourneyEventType, fields: ShareFieldSet): ShareFieldSet {
  const available = FIELDS_BY_TYPE[type]
  const entries = SHARE_FIELDS.map(
    (field) => [field, available.includes(field) && fields[field]] as const,
  )
  return Object.fromEntries(entries) as ShareFieldSet
}

// ---------------------------------------------------------------------------
// o dado que o template desenha
// ---------------------------------------------------------------------------

export interface ShareMetric {
  /** Já formatado: "87%", "84", "5/5", "19". */
  readonly value: string
  readonly label: string | null
}

export interface ShareCardItem {
  readonly label: string
  readonly done: boolean
}

export interface ShareCardData {
  readonly eventType: JourneyEventType
  /** Linha curta em caixa alta acima do título. Null quando não há. */
  readonly kicker: string | null
  readonly title: string
  readonly subtitle: string | null
  /** A estrela do card: o número que ocupa a maior área. */
  readonly primaryMetric: ShareMetric
  readonly secondaryMetric: ShareMetric | null
  readonly momentumBefore: number | null
  readonly momentumAfter: number | null
  readonly momentumChange: number | null
  readonly completionPercentage: number | null
  readonly items: readonly ShareCardItem[]
  readonly date: string | null
  readonly username: string | null
  readonly branding: boolean
  /** A frase de continuidade. Nunca elogio genérico. */
  readonly note: string | null
  /** Cor de acento: o eixo do evento, ou a marca. */
  readonly accent: string
}
