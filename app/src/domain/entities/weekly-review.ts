import { DomainError } from '@/shared/errors'
import { addDays, dayKeyToDate, startOfWeek, type DayKey } from './day'

/**
 * O review escrito da semana.
 *
 * A `WeekReview` de `review.ts` é a leitura que o app FAZ dos dados. Esta aqui
 * é o que a PESSOA escreve: dificuldade, aprendizado, ajuste e prioridades da
 * semana seguinte. São coisas diferentes e por isso moram separadas — uma é
 * calculada e nunca é salva, a outra é digitada e precisa sobreviver.
 *
 * O fluxo é guiado e salva a cada passo. Review pela metade é o caso comum, não
 * a exceção: a pessoa abre no domingo à noite, escreve dois campos e fecha. Sem
 * rascunho persistido ela recomeça do zero e nunca termina nenhum.
 */

export const REVIEW_STEPS = [
  'resumo',
  'conquistas',
  'pendencias',
  'habitos',
  'dificuldades',
  'aprendizados',
  'ajustes',
  'prioridades',
] as const
export type ReviewStep = (typeof REVIEW_STEPS)[number]

export interface ReviewStepMeta {
  readonly key: ReviewStep
  readonly title: string
  /** A pergunta como uma pessoa faria. */
  readonly question: string
  readonly placeholder: string
  /** Passo que o app preenche sozinho: a pessoa lê e confirma, não escreve. */
  readonly readOnly: boolean
}

export const REVIEW_STEP_META: readonly ReviewStepMeta[] = [
  {
    key: 'resumo',
    title: 'A semana',
    question: 'Foi assim que a semana saiu.',
    placeholder: '',
    readOnly: true,
  },
  {
    key: 'conquistas',
    title: 'Conquistas',
    question: 'O que você fez essa semana que valeu a pena?',
    placeholder: 'Voltei a treinar depois de duas semanas paradas.',
    readOnly: false,
  },
  {
    key: 'pendencias',
    title: 'O que ficou',
    question: 'Essas ações não saíram. O que você quer fazer com elas?',
    placeholder: '',
    readOnly: true,
  },
  {
    key: 'habitos',
    title: 'Hábitos',
    question: 'Como foi a constância dos teus hábitos.',
    placeholder: '',
    readOnly: true,
  },
  {
    key: 'dificuldades',
    title: 'Dificuldades',
    question: 'O que atrapalhou?',
    placeholder: 'Reuniões no fim da tarde comeram o horário de estudo.',
    readOnly: false,
  },
  {
    key: 'aprendizados',
    title: 'Aprendizados',
    question: 'O que você aprendeu sobre como você funciona?',
    placeholder: 'Rendo mais de manhã, mesmo dormindo menos.',
    readOnly: false,
  },
  {
    key: 'ajustes',
    title: 'Ajustes',
    question: 'O que muda na semana que vem?',
    placeholder: 'Passar o estudo pra antes do trabalho.',
    readOnly: false,
  },
  {
    key: 'prioridades',
    title: 'Prioridades',
    question: 'Quais são as três coisas que importam na próxima semana?',
    placeholder: 'Terminar o capítulo 5.',
    readOnly: false,
  },
]

export const MAX_REVIEW_ANSWER = 600
export const MAX_PRIORITIES = 3

/**
 * O check-in do gratuito: quatro perguntas, respondidas de memória.
 *
 * O review completo cruza os dados reais da semana (execução, pendências,
 * hábitos, a recomendação) e isso é analisar — o PRO. O gratuito não perde a
 * pausa semanal, perde a leitura automática: as perguntas guardam nos mesmos
 * campos, então quem passa pro PRO reencontra o que escreveu no lugar certo.
 */
export const BASIC_REVIEW_STEPS = [
  'aprendizados',
  'conquistas',
  'dificuldades',
  'prioridades',
] as const satisfies readonly ReviewStep[]

export const BASIC_REVIEW_STEP_META: readonly ReviewStepMeta[] = [
  {
    key: 'aprendizados',
    title: 'A semana',
    question: 'Como foi sua semana?',
    placeholder: 'Corrida, mas consegui manter o essencial.',
    readOnly: false,
  },
  {
    key: 'conquistas',
    title: 'O que funcionou',
    question: 'O que funcionou?',
    placeholder: 'Estudar antes do trabalho segurou a semana.',
    readOnly: false,
  },
  {
    key: 'dificuldades',
    title: 'O que dificultou',
    question: 'O que dificultou sua constância?',
    placeholder: 'Reuniões no fim da tarde comeram o horário de estudo.',
    readOnly: false,
  },
  {
    key: 'prioridades',
    title: 'Próxima semana',
    question: 'Qual será seu foco na próxima semana?',
    placeholder: 'Terminar o capítulo 5.',
    readOnly: false,
  },
]

/** Quanto do check-in básico já foi respondido, de 0 a 1. */
export function basicReviewProgress(review: WeeklyReview): number {
  const answered = [
    review.learnings,
    review.achievements,
    review.difficulties,
    review.priorities.length > 0 ? 'x' : null,
  ].filter(Boolean).length

  return answered / BASIC_REVIEW_STEPS.length
}

export interface WeeklyReview {
  readonly id: string
  readonly userId: string
  /** Segunda-feira da semana revisada. É a chave: um review por semana. */
  readonly weekStart: DayKey
  readonly achievements: string | null
  readonly difficulties: string | null
  readonly learnings: string | null
  readonly adjustments: string | null
  readonly priorities: readonly string[]
  /** Síntese gerada pela IA, quando a pessoa pediu. Nunca sobrescreve o texto dela. */
  readonly aiSummary: string | null
  /** Último passo aberto. É por onde o review incompleto retoma. */
  readonly lastStep: ReviewStep
  readonly completedAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface WeeklyReviewDraft {
  readonly achievements?: string | null
  readonly difficulties?: string | null
  readonly learnings?: string | null
  readonly adjustments?: string | null
  readonly priorities?: readonly string[]
  readonly aiSummary?: string | null
  readonly lastStep?: ReviewStep
  readonly completedAt?: Date | null
}

export function emptyReview(userId: string, weekStart: DayKey, id: string, now = new Date()): WeeklyReview {
  return {
    id,
    userId,
    weekStart,
    achievements: null,
    difficulties: null,
    learnings: null,
    adjustments: null,
    priorities: [],
    aiSummary: null,
    lastStep: 'resumo',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Aplica o rascunho no review. Só o que veio no draft muda: o fluxo salva um
 * passo por vez, e um campo ausente significa "não mexi nesse", nunca "apaga".
 */
export function applyDraft(
  review: WeeklyReview,
  draft: WeeklyReviewDraft,
  now = new Date(),
): WeeklyReview {
  return {
    ...review,
    achievements: text(draft.achievements, review.achievements),
    difficulties: text(draft.difficulties, review.difficulties),
    learnings: text(draft.learnings, review.learnings),
    adjustments: text(draft.adjustments, review.adjustments),
    priorities:
      draft.priorities === undefined
        ? review.priorities
        : draft.priorities
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, MAX_PRIORITIES),
    aiSummary: draft.aiSummary === undefined ? review.aiSummary : draft.aiSummary,
    lastStep: draft.lastStep ?? review.lastStep,
    completedAt: draft.completedAt === undefined ? review.completedAt : draft.completedAt,
    updatedAt: now,
  }
}

function text(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback
  if (value === null) return null

  const trimmed = value.trim()
  if (trimmed.length > MAX_REVIEW_ANSWER) {
    throw new DomainError(`Cada resposta pode ter no máximo ${MAX_REVIEW_ANSWER} caracteres.`)
  }
  return trimmed || null
}

/** A semana que o review de hoje revisa: a anterior, não a corrente. */
export function reviewWeekStart(today: DayKey): DayKey {
  return addDays(startOfWeek(today), -7)
}

export function isComplete(review: WeeklyReview): boolean {
  return review.completedAt !== null
}

/**
 * Quanto do review já foi preenchido, de 0 a 1. Os passos que o app escreve
 * sozinho contam como prontos: eles não dependem da pessoa.
 */
export function reviewProgress(review: WeeklyReview): number {
  const answered = [
    review.achievements,
    review.difficulties,
    review.learnings,
    review.adjustments,
    review.priorities.length > 0 ? 'x' : null,
  ].filter(Boolean).length

  return answered / 5
}

export function weekLabel(weekStart: DayKey): string {
  const end = addDays(weekStart, 6)
  const format = (day: DayKey) =>
    dayKeyToDate(day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return `${format(weekStart)} a ${format(end)}`
}
