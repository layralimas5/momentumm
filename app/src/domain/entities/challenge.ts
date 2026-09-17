import { DomainError } from '@/shared/errors'
import type { Activity } from './activity'
import { activityType, formatUnit, type ActivityTypeSlug } from './activity-type'
import { addDays, dayRange, daysBetween, startOfWeek, type DayKey } from './day'
import { countsAsDone, type HabitLog } from './habit'

/**
 * Desafio entre amigos.
 *
 * ## O que ele NÃO é
 *
 * Não é um módulo novo. O desafio não guarda registro de esforço, não tem
 * unidade própria e não conhece leitura, treino nem estudo: ele é uma LEITURA
 * sobre o que a pessoa já registra. Quem move o progresso continua sendo a
 * atividade — ou o hábito que a pessoa vinculou. Se um dia um desafio precisar
 * de tabela de progresso por dia, é sinal de que o desenho saiu do trilho.
 *
 * ## A unidade do desafio é o DIA CUMPRIDO
 *
 * Os três modos contam a mesma coisa e diferem só no que exigem dela:
 *
 * - `diaria` — todo dia da janela. "Ler 30 minutos por dia."
 * - `semanal` — X dias por semana, sem dia marcado. "Treinar 4x por semana."
 * - `total` — X dias ao longo da janela, quando não importa. "Treinar 20 dias
 *   no mês."
 *
 * Contar volume acumulado seria a quarta forma, e ela já existe: chama-se
 * objetivo. O desafio é sobre APARECER, e é por isso que ele funciona entre
 * pessoas cujas metas são diferentes — 30 minutos dela e 1h dele fecham o
 * mesmo dia.
 *
 * ## De onde vem o dia cumprido
 *
 * Duas origens, nessa ordem de preferência:
 *
 * 1. O hábito vinculado. O dia fecha quando o hábito foi marcado (inclusive na
 *    versão mínima — a regra do produto vale aqui também).
 * 2. As atividades do eixo. O dia fecha quando o volume registrado alcança
 *    `dailyTarget`.
 *
 * O hábito vem primeiro porque é o que já existe na rotina da pessoa. Desafio
 * que obriga a registrar de novo o que ela já registrou é desafio que morre na
 * segunda semana.
 *
 * ## Privado por padrão
 *
 * Todo desafio é privado: existe só pra quem foi convidado. Não há descoberta,
 * não há desafio público e não há ranking fora dele. O que atravessa a fronteira
 * do desafio é um `JourneyEvent`, e ele nasce privado como todos os outros.
 */

export const MAX_CHALLENGE_NAME = 60
export const MAX_CHALLENGE_DESCRIPTION = 280
/** Menos de três dias não é desafio, é um dia com testemunha. */
export const MIN_CHALLENGE_DAYS = 3
export const MAX_CHALLENGE_DAYS = 180
export const MAX_CHALLENGE_PARTICIPANTS = 12

export const CHALLENGE_MODES = ['diaria', 'semanal', 'total'] as const
export type ChallengeMode = (typeof CHALLENGE_MODES)[number]

export const CHALLENGE_MODE_LABELS: Readonly<Record<ChallengeMode, string>> = {
  diaria: 'Todo dia',
  semanal: 'Vezes por semana',
  total: 'Quantidade total',
}

export const CHALLENGE_MODE_HINTS: Readonly<Record<ChallengeMode, string>> = {
  diaria: 'Cada dia da janela conta.',
  semanal: 'Quantos dias por semana, sem dia marcado.',
  total: 'Quantos dias no total, quando não importa quais.',
}

export interface Challenge {
  readonly id: string
  /** Quem criou. É o único que edita, encerra e convida. */
  readonly ownerId: string
  readonly name: string
  readonly description: string | null
  /** O eixo que o desafio acompanha quando ninguém vinculou hábito. */
  readonly axis: ActivityTypeSlug
  readonly mode: ChallengeMode
  /**
   * A meta do modo: dias por semana em `semanal`, dias no total em `total`.
   * Em `diaria` a meta é a janela inteira e este número não é usado.
   */
  readonly target: number
  /**
   * Quanto fecha um dia, na unidade do eixo. Ignorado por quem vinculou um
   * hábito: ali quem decide o que é um dia cumprido é o próprio hábito.
   */
  readonly dailyTarget: number
  readonly startsOn: DayKey
  readonly endsOn: DayKey
  readonly createdAt: Date
  /** Encerrado pelo dono. Fecha pra todo mundo, não só pra ele. */
  readonly completedAt: Date | null
  readonly archivedAt: Date | null
}

export const PARTICIPANT_STATUSES = ['convidado', 'ativo', 'recusado', 'saiu'] as const
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number]

export const PARTICIPANT_STATUS_LABELS: Readonly<Record<ParticipantStatus, string>> = {
  convidado: 'Convidado',
  ativo: 'Participando',
  recusado: 'Recusou',
  saiu: 'Saiu',
}

/**
 * A participação de uma pessoa num desafio.
 *
 * `doneDays` é o ÚNICO número publicado. Ele existe porque o progresso de
 * alguém é calculado a partir de hábitos e atividades que a RLS não deixa
 * ninguém mais ler — e nem deveria. Entrar num desafio é consentir em mostrar
 * quantos dias você fechou nele, e nada além disso: nem o hábito que usou, nem
 * o volume, nem o momentum.
 *
 * Ele é materializado, não derivado, porque é o único jeito de um participante
 * ver o avanço do outro sem que os dois abram a rotina um pro outro. Quem
 * escreve é sempre o próprio dono da linha.
 */
export interface ChallengeParticipant {
  readonly id: string
  readonly challengeId: string
  readonly userId: string
  readonly status: ParticipantStatus
  /**
   * O hábito que essa pessoa vinculou. É escolha dela e vale só pra ela: o
   * desafio combina o QUE cumprir, não com qual hábito cada um cumpre.
   */
  readonly habitId: string | null
  /** Dias fechados no desafio, publicados pelo próprio participante. */
  readonly doneDays: number
  readonly invitedAt: Date
  readonly joinedAt: Date | null
  readonly completedAt: Date | null
}

export interface NewChallengeInput {
  readonly ownerId: string
  readonly name: string
  readonly axis: ActivityTypeSlug
  readonly mode: ChallengeMode
  readonly startsOn: DayKey
  readonly endsOn: DayKey
  readonly description?: string | null
  readonly target?: number
  readonly dailyTarget?: number
  readonly habitId?: string | null
}

const MAX_TIMES_PER_WEEK = 7

export function createChallenge(
  input: NewChallengeInput,
  id: string,
  now = new Date(),
): Challenge {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 3) {
    throw new DomainError('Dá um nome ao desafio com pelo menos 3 letras.')
  }
  if (name.length > MAX_CHALLENGE_NAME) {
    throw new DomainError(`O nome pode ter no máximo ${MAX_CHALLENGE_NAME} caracteres.`)
  }

  const description = input.description?.trim() || null
  if (description && description.length > MAX_CHALLENGE_DESCRIPTION) {
    throw new DomainError(
      `A descrição pode ter no máximo ${MAX_CHALLENGE_DESCRIPTION} caracteres.`,
    )
  }

  const span = daysBetween(input.startsOn, input.endsOn) + 1
  if (span < MIN_CHALLENGE_DAYS) {
    throw new DomainError(`Um desafio precisa de pelo menos ${MIN_CHALLENGE_DAYS} dias.`)
  }
  if (span > MAX_CHALLENGE_DAYS) {
    throw new DomainError('Mais de seis meses deixa de ser desafio e vira objetivo.')
  }

  const dailyTarget = Math.round(input.dailyTarget ?? 1)
  if (!Number.isFinite(dailyTarget) || dailyTarget <= 0) {
    throw new DomainError('O que fecha um dia precisa ser maior que zero.')
  }

  return {
    id,
    ownerId: input.ownerId,
    name,
    description,
    axis: input.axis,
    mode: input.mode,
    target: normalizeTarget(input.mode, input.target, span),
    dailyTarget,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    createdAt: now,
    completedAt: null,
    archivedAt: null,
  }
}

/**
 * A meta do modo, validada contra a janela.
 *
 * Um desafio de "25 dias" numa janela de 14 nunca poderia ser cumprido, e
 * descobrir isso no último dia é a pior hora possível.
 */
function normalizeTarget(mode: ChallengeMode, target: number | undefined, span: number): number {
  if (mode === 'diaria') return span

  const rounded = Math.round(target ?? 0)
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new DomainError('A meta do desafio precisa ser maior que zero.')
  }

  if (mode === 'semanal') {
    if (rounded > MAX_TIMES_PER_WEEK) {
      throw new DomainError('São no máximo 7 dias por semana.')
    }
    return rounded
  }

  if (rounded > span) {
    throw new DomainError('A meta não cabe no período: são mais dias do que o desafio tem.')
  }
  return rounded
}

export function createParticipant(
  input: {
    readonly challengeId: string
    readonly userId: string
    readonly status?: ParticipantStatus
    readonly habitId?: string | null
  },
  id: string,
  now = new Date(),
): ChallengeParticipant {
  const status = input.status ?? 'convidado'

  return {
    id,
    challengeId: input.challengeId,
    userId: input.userId,
    status,
    habitId: input.habitId ?? null,
    doneDays: 0,
    invitedAt: now,
    // Quem entra direto (o dono) já está dentro; convidado só entra ao aceitar.
    joinedAt: status === 'ativo' ? now : null,
    completedAt: null,
  }
}

// ---------------------------------------------------------------------------
// janela e exigência
// ---------------------------------------------------------------------------

export function challengeDays(challenge: Challenge): number {
  return daysBetween(challenge.startsOn, challenge.endsOn) + 1
}

/**
 * Quantos dias cumpridos o desafio pede.
 *
 * É a resposta única pro denominador de todo progresso e de todo ranking. Cada
 * tela recalculando isso seria o mesmo erro que motivou o `plan-progress`: duas
 * telas discordando sobre o mesmo número.
 */
export function requiredDays(challenge: Challenge): number {
  switch (challenge.mode) {
    case 'diaria':
      return challengeDays(challenge)
    case 'total':
      return challenge.target
    case 'semanal': {
      // Semanas do calendário tocadas pela janela, não a divisão por sete: um
      // desafio que começa numa quinta cobra a semana da quinta inteira ou não
      // cobra nenhuma, e cobrar meia semana é o tipo de conta que ninguém
      // consegue conferir de cabeça.
      const weeks = weeksOf(challenge).length
      return weeks * challenge.target
    }
  }
}

/** As segundas-feiras que a janela do desafio toca. */
export function weeksOf(challenge: Challenge): DayKey[] {
  const weeks: DayKey[] = []
  let cursor = startOfWeek(challenge.startsOn)
  const last = startOfWeek(challenge.endsOn)

  while (daysBetween(cursor, last) >= 0) {
    weeks.push(cursor)
    cursor = addDays(cursor, 7)
  }

  return weeks
}

export function isChallengeRunning(challenge: Challenge, today: DayKey): boolean {
  return (
    challenge.archivedAt === null &&
    challenge.completedAt === null &&
    today <= challenge.endsOn
  )
}

export function hasStarted(challenge: Challenge, today: DayKey): boolean {
  return today >= challenge.startsOn
}

/** Dias que ainda restam na janela, incluindo hoje. */
export function daysLeftOf(challenge: Challenge, today: DayKey): number {
  return Math.max(0, daysBetween(today, challenge.endsOn) + 1)
}

// ---------------------------------------------------------------------------
// o dia cumprido
// ---------------------------------------------------------------------------

export interface ChallengeSources {
  /** As atividades da pessoa. Só as do eixo e da janela entram na conta. */
  readonly activities: readonly Activity[]
  /** Os registros do hábito vinculado, quando existe um. */
  readonly habitLogs: readonly HabitLog[]
}

/**
 * Os dias que essa pessoa fechou no desafio.
 *
 * Função pura sobre o que ela já registrou. Roda só com os dados de quem está
 * logado — o progresso dos outros chega publicado, porque a rotina de ninguém
 * é legível por mais ninguém.
 */
export function doneDaysOf(
  challenge: Challenge,
  participant: ChallengeParticipant,
  sources: ChallengeSources,
): DayKey[] {
  const window = dayRange(challenge.startsOn, challenge.endsOn)

  if (participant.habitId) {
    const done = new Set(
      sources.habitLogs
        .filter((log) => log.habitId === participant.habitId && countsAsDone(log.status))
        .map((log) => log.day),
    )
    return window.filter((day) => done.has(day))
  }

  const volumeByDay = new Map<DayKey, number>()
  for (const activity of sources.activities) {
    if (activity.type !== challenge.axis) continue
    if (activity.day < challenge.startsOn || activity.day > challenge.endsOn) continue
    volumeByDay.set(activity.day, (volumeByDay.get(activity.day) ?? 0) + activity.value)
  }

  return window.filter((day) => (volumeByDay.get(day) ?? 0) >= challenge.dailyTarget)
}

/**
 * Quantos desses dias o desafio aceita.
 *
 * No modo semanal a cota é POR SEMANA: sete dias numa semana de um desafio de
 * três vezes contam três, e não sete. Sem esse teto, quem faz tudo numa semana
 * e some nas outras terminaria empatado com quem apareceu toda semana — e o
 * desafio existe justamente pra premiar a segunda.
 */
export function countedDays(challenge: Challenge, days: readonly DayKey[]): number {
  if (challenge.mode !== 'semanal') {
    return Math.min(days.length, requiredDays(challenge))
  }

  const perWeek = new Map<DayKey, number>()
  for (const day of days) {
    const week = startOfWeek(day)
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1)
  }

  let total = 0
  for (const count of perWeek.values()) {
    total += Math.min(count, challenge.target)
  }
  return total
}

// ---------------------------------------------------------------------------
// progresso
// ---------------------------------------------------------------------------

export const CHALLENGE_STATUSES = [
  'nao-comecou',
  'no-ritmo',
  'atencao',
  'atrasado',
  'concluido',
  'encerrado',
] as const
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number]

export const CHALLENGE_STATUS_LABELS: Readonly<Record<ChallengeStatus, string>> = {
  'nao-comecou': 'Ainda não começou',
  'no-ritmo': 'No ritmo',
  atencao: 'Atenção',
  atrasado: 'Atrasado',
  concluido: 'Concluído',
  encerrado: 'Encerrado',
}

export interface ChallengeProgress {
  readonly participant: ChallengeParticipant
  readonly done: number
  readonly required: number
  /** 0 a 1. */
  readonly ratio: number
  readonly remaining: number
  readonly status: ChallengeStatus
  readonly daysLeft: number
  /** Quanto da janela já passou, de 0 a 1. */
  readonly elapsed: number
  readonly summary: string
}

/** A mesma margem do objetivo: estar um pouco atrás ainda é estar no ritmo. */
const ON_TRACK_TOLERANCE = 0.1
const BEHIND_TOLERANCE = 0.25

export function progressOf(
  challenge: Challenge,
  participant: ChallengeParticipant,
  today: DayKey,
): ChallengeProgress {
  const required = requiredDays(challenge)
  const done = Math.min(participant.doneDays, required)
  const ratio = required === 0 ? 0 : done / required
  const remaining = Math.max(0, required - done)

  const total = challengeDays(challenge)
  const elapsedDays = Math.min(total, Math.max(0, daysBetween(challenge.startsOn, today) + 1))
  const elapsed = total === 0 ? 0 : elapsedDays / total
  const daysLeft = daysLeftOf(challenge, today)

  const status = statusOf({ challenge, participant, ratio, elapsed, today })

  return {
    participant,
    done,
    required,
    ratio,
    remaining,
    status,
    daysLeft,
    elapsed,
    summary: summarize({ challenge, status, done, required, remaining, daysLeft }),
  }
}

function statusOf(input: {
  challenge: Challenge
  participant: ChallengeParticipant
  ratio: number
  elapsed: number
  today: DayKey
}): ChallengeStatus {
  if (input.participant.completedAt || input.ratio >= 1) return 'concluido'
  if (!hasStarted(input.challenge, input.today)) return 'nao-comecou'
  if (input.challenge.archivedAt || input.today > input.challenge.endsOn) return 'encerrado'
  if (input.challenge.completedAt) return 'encerrado'
  if (input.ratio >= input.elapsed - ON_TRACK_TOLERANCE) return 'no-ritmo'
  if (input.ratio >= input.elapsed - BEHIND_TOLERANCE) return 'atencao'
  return 'atrasado'
}

function summarize(input: {
  challenge: Challenge
  status: ChallengeStatus
  done: number
  required: number
  remaining: number
  daysLeft: number
}): string {
  const days = (count: number) => `${count} ${count === 1 ? 'dia' : 'dias'}`

  switch (input.status) {
    case 'concluido':
      return `Desafio fechado: ${days(input.required)}.`
    case 'nao-comecou':
      return 'Começa em breve. Nada a cumprir por enquanto.'
    case 'encerrado':
      return `Encerrado com ${days(input.done)} de ${input.required}.`
    case 'no-ritmo':
      return input.daysLeft <= 1
        ? `Último dia: faltam ${days(input.remaining)}.`
        : `No ritmo. Faltam ${days(input.remaining)} em ${days(input.daysLeft)}.`
    case 'atencao':
      return `Um pouco atrás. Faltam ${days(input.remaining)} e restam ${days(input.daysLeft)}.`
    case 'atrasado':
      return input.remaining > input.daysLeft
        ? `Não dá mais pra fechar inteiro, e isso não anula o que já saiu: ${days(input.done)} valem.`
        : `Atrasado: faltam ${days(input.remaining)} e restam ${days(input.daysLeft)}.`
  }
}

/** A regra do desafio em uma linha. É o que o card mostra abaixo do nome. */
export function describeChallenge(challenge: Challenge, habitName?: string | null): string {
  const what = habitName ?? formatUnit(activityType(challenge.axis), challenge.dailyTarget)

  switch (challenge.mode) {
    case 'diaria':
      return `${what} por dia, durante ${challengeDays(challenge)} dias`
    case 'semanal':
      return `${what}, ${challenge.target}x por semana`
    case 'total':
      return `${what} em ${challenge.target} dias`
  }
}

// ---------------------------------------------------------------------------
// participantes e ranking
// ---------------------------------------------------------------------------

export function isParticipating(participant: ChallengeParticipant): boolean {
  return participant.status === 'ativo'
}

/** Quem conta como dentro do desafio: participando ou ainda decidindo. */
export function isOnBoard(participant: ChallengeParticipant): boolean {
  return participant.status === 'ativo' || participant.status === 'convidado'
}

export function participantOf(
  participants: readonly ChallengeParticipant[],
  userId: string,
): ChallengeParticipant | null {
  return participants.find((item) => item.userId === userId) ?? null
}

export function invitesFor(
  participants: readonly ChallengeParticipant[],
  userId: string,
): ChallengeParticipant[] {
  return participants.filter((item) => item.userId === userId && item.status === 'convidado')
}

export interface RankedParticipant {
  readonly progress: ChallengeProgress
  /** Começa em 1. Empate recebe a mesma posição. */
  readonly position: number
}

/**
 * A classificação DENTRO do desafio, e só dela.
 *
 * Nada aqui compara Momentumm Score, constância ou volume: o único número é o
 * dia cumprido, que é o que as duas pessoas combinaram cumprir. Score é a
 * comparação de alguém com ela mesma, e transportá-lo pra uma tabela entre
 * amigos é exatamente o ranking que o produto recusa.
 *
 * Empate mantém a mesma posição de propósito: dois amigos com nove dias cada
 * estão no mesmo lugar, e desempatar por horário premiaria quem acordou cedo.
 */
export function rankParticipants(
  challenge: Challenge,
  participants: readonly ChallengeParticipant[],
  today: DayKey,
): RankedParticipant[] {
  const sorted = participants
    .filter(isParticipating)
    .map((participant) => progressOf(challenge, participant, today))
    .sort((a, b) => b.done - a.done)

  let position = 0
  let previous: number | null = null

  return sorted.map((progress, index) => {
    if (previous === null || progress.done < previous) {
      position = index + 1
      previous = progress.done
    }
    return { progress, position }
  })
}

/** O avanço do grupo: a média simples de quem está dentro. */
export function groupRatio(
  challenge: Challenge,
  participants: readonly ChallengeParticipant[],
  today: DayKey,
): number {
  const active = participants.filter(isParticipating)
  if (active.length === 0) return 0

  const total = active.reduce(
    (sum, participant) => sum + progressOf(challenge, participant, today).ratio,
    0,
  )
  return total / active.length
}

/**
 * O desafio inteiro foi cumprido?
 *
 * Exige TODO mundo, não a média: um desafio que fecha com metade do grupo em
 * pé transformaria o outro lado em plateia.
 */
export function everyoneFinished(
  challenge: Challenge,
  participants: readonly ChallengeParticipant[],
  today: DayKey,
): boolean {
  const active = participants.filter(isParticipating)
  if (active.length === 0) return false
  return active.every((participant) => progressOf(challenge, participant, today).ratio >= 1)
}
