import type { Activity } from './activity'
import { totalMinutes } from './activity'
import type { CapacityProfile } from './checkin'
import { addDays, dayRange, daysBetween, type DayKey } from './day'
import { countsAsDone, type Habit, type HabitLog } from './habit'
import { habitImpact, impactPointsOf, taskImpact, type ImpactLevel } from './momentum-impact'
import { type Task } from './task'
import type { WeeklyReview } from './weekly-review'

/**
 * Momentum: o ritmo da pessoa, não a nota dela.
 *
 * O score vai de 0 a 100 e sai de quatro fatores, cada um normalizado entre 0 e
 * 100 antes de entrar na média ponderada:
 *
 *   Consistência recente ....... 35%
 *   Execução das prioridades ... 30%
 *   Progresso nos objetivos .... 20%
 *   Capacidade de retomada ..... 15%
 *
 * ## A janela é de 28 dias, com a última semana pesando mais
 *
 * Sete dias sozinhos transformam o número num termômetro de humor: uma gripe
 * derruba o score inteiro e some com a história de um mês inteiro de trabalho.
 * Vinte e oito dias sozinhos fazem o contrário — a pessoa muda o comportamento
 * hoje e o número não reage, então ele deixa de servir pra decidir alguma
 * coisa. A saída é a janela longa com peso: cada um dos últimos sete dias vale
 * o triplo dos vinte e um anteriores, o que faz a semana atual responder por
 * metade do score e as três anteriores pela outra metade.
 *
 * ## O que conta é impacto, não quantidade
 *
 * Cada coisa concluída vale 1, 2 ou 3 (ver `momentum-impact`). Contar itens
 * faria cinco hábitos de dois minutos renderem mais que a ação que destrava a
 * etapa do objetivo — o oposto do que o produto defende.
 *
 * E existe teto: hábitos rendem no máximo `MAX_HABIT_IMPACT_PER_DAY` por dia,
 * ações de impacto baixo no máximo `MAX_LOW_IMPACT_PER_DAY`, e o dia inteiro
 * satura em `FULL_DAY_IMPACT`. Sem os tetos, criar hábitos fáceis vira a
 * maneira mais rápida de subir o número.
 *
 * ## Falhar um dia custa pouco, e voltar rápido devolve
 *
 * Um dia vazio é um dia sem crédito, nunca um zero no score: com 28 dias na
 * conta, o pior dia possível tira poucos pontos. E a retomada mede o TEMPO até
 * o retorno — voltar no dia seguinte devolve nota cheia, sumir duas semanas
 * não.
 */

/** A semana: a unidade de comparação do produto (e a régua de "recente"). */
export const MOMENTUM_WINDOW_DAYS = 7

/** O horizonte do score. Quatro semanas: tempo de ver rotina, não humor. */
export const MOMENTUM_HORIZON_DAYS = 28

/** Peso de cada dia da última semana contra cada dia das três anteriores. */
const RECENT_DAY_WEIGHT = 3
const OLDER_DAY_WEIGHT = 1

/**
 * Impacto que caracteriza um dia cumprido: uma ação de alta (3) mais um hábito
 * (1). Acima disso o dia não rende mais — dia excepcional não é o que sustenta
 * ritmo, e premiar o excesso é premiar o que vem antes de parar.
 */
const FULL_DAY_IMPACT = 4

/**
 * Teto do que a repetição rende por dia — e ele é menor que uma prioridade de
 * propósito.
 *
 * Com teto 3, marcar três hábitos fáceis empataria com fechar a ação que
 * destrava a etapa, e a maneira mais rápida de subir o score passaria a ser
 * criar hábitos pequenos. Em 2, a prioridade ganha sempre.
 */
const MAX_HABIT_IMPACT_PER_DAY = 2

/** Teto da tarefa comum por dia, pelo mesmo motivo e com a mesma régua. */
const MAX_LOW_IMPACT_PER_DAY = 2

/** Teto do registro avulso por dia: quem registra dez leituras não fez dez. */
const MAX_ACTIVITY_IMPACT_PER_DAY = 2

/** Quanto do dia vale só por ter tido movimento, antes de olhar o tamanho. */
const PRESENCE_CREDIT = 0.5

/**
 * Avanço de plano que satura o fator de objetivos em 28 dias. 35% do caminho
 * num mês é ritmo de quem fecha o objetivo em cerca de três meses.
 */
const PLAN_GAIN_CEILING = 0.35

/** Dias sem movimento a partir dos quais existe uma falha pra retomar. */
const GAP_FOR_RECOVERY = 2

/**
 * Peso da retomada mais recente contra as anteriores.
 *
 * O fator responde "você consegue voltar?", e a resposta que vale é a de
 * agora. Com média simples, quem voltou hoje depois de três pausas antigas mal
 * move o número — e o dia em que a pessoa mais precisa ver o esforço aparecer
 * é justamente o dia em que ela voltou. O peso é 2 e não mais: acima disso o
 * fator vira termômetro de um dia só, que é o defeito que a janela de 28 dias
 * existe pra evitar.
 */
const LATEST_RETURN_WEIGHT = 2

/** Dias de história a partir dos quais o score deixa de ser parcial. */
const MIN_DAYS_FOR_FULL_SCORE = 7

export const MOMENTUM_LEVELS = ['desacelerando', 'retomando', 'constante', 'avancando'] as const
export type MomentumLevel = (typeof MOMENTUM_LEVELS)[number]

export const MOMENTUM_LEVEL_LABELS: Readonly<Record<MomentumLevel, string>> = {
  desacelerando: 'Desacelerando',
  retomando: 'Retomando',
  constante: 'Constante',
  avancando: 'Avançando',
}

/**
 * Os pesos, em um lugar só e somando 1. Ficam exportados porque a calibragem
 * certa só aparece com uso real, e ajustar não pode exigir caçar constante
 * espalhada pelo arquivo.
 */
export interface MomentumWeights {
  readonly consistency: number
  readonly priorities: number
  readonly objectives: number
  readonly recovery: number
}

export const DEFAULT_MOMENTUM_WEIGHTS: MomentumWeights = {
  consistency: 0.35,
  priorities: 0.3,
  objectives: 0.2,
  recovery: 0.15,
}

export type MomentumPartKey = keyof MomentumWeights

export const MOMENTUM_PART_LABELS: Readonly<Record<MomentumPartKey, string>> = {
  consistency: 'Consistência recente',
  priorities: 'Execução das prioridades',
  objectives: 'Progresso nos objetivos',
  recovery: 'Capacidade de retomada',
}

export const MOMENTUM_PART_HINTS: Readonly<Record<MomentumPartKey, string>> = {
  consistency:
    'Em quantos dias você moveu alguma coisa, com os últimos sete dias pesando o triplo dos anteriores.',
  priorities:
    'Do que você planejou, quanto saiu — medido por impacto: prioridade e ação de objetivo valem mais que tarefa comum.',
  objectives: 'O quanto o plano dos teus objetivos andou de verdade no período.',
  recovery:
    'Depois de um dia parado, quanto tempo você leva pra voltar. Voltar rápido devolve tudo, e a volta mais recente é a que mais conta.',
}

export interface MomentumInput {
  readonly activities: readonly Activity[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly today: DayKey
  /** Reviews escritos. Não entram no score; ficam pro resto do app. */
  readonly weeklyReviews?: readonly WeeklyReview[]
  /**
   * Progresso de plano ganho na janela atual e na anterior, de 0 a 1.
   *
   * Vem de fora porque depende de etapas, e o momentum não conhece a
   * hierarquia. Undefined deixa o fator sem base, e aí ele herda a
   * consistência em vez de zerar: conta sem plano montado não é conta parada.
   */
  readonly planGain?: number
  readonly previousPlanGain?: number
}

/** Cada parte, de 0 a 1. */
export type MomentumParts = Readonly<Record<MomentumPartKey, number>>

/** Quais partes tinham dados de verdade. Falso significa "herdou a consistência". */
export type MomentumBasis = Readonly<Record<MomentumPartKey, boolean>>

export interface MomentumPoint {
  readonly day: DayKey
  readonly value: number
}

export interface MomentumDriver {
  readonly key: MomentumPartKey
  readonly label: string
  /** Pontos ganhos (positivo) ou perdidos (negativo) contra a semana anterior. */
  readonly delta: number
}

export interface MomentumScore {
  /** 0 a 100. */
  readonly value: number
  readonly level: MomentumLevel
  /** Diferença em pontos contra o mesmo cálculo sete dias atrás. */
  readonly delta: number
  /** Dias com movimento nos últimos sete. */
  readonly activeDays: number
  /** Dias com movimento em todo o horizonte de 28 dias. */
  readonly activeDaysInHorizon: number
  readonly parts: MomentumParts
  readonly basis: MomentumBasis
  /**
   * Falso enquanto a conta não tem uma semana de história: o número aparece,
   * mas a tela avisa que ainda está se formando em vez de vender precisão que
   * não existe.
   */
  readonly hasEnoughData: boolean
  /** O que subiu e o que caiu contra a semana passada, do maior pro menor. */
  readonly drivers: readonly MomentumDriver[]
  /** Uma frase curta e pessoal. É o que a tela mostra ao lado do número. */
  readonly headline: string
  /** A leitura completa, em uma frase. */
  readonly explanation: string
}

export function calculateMomentum(
  input: MomentumInput,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumScore {
  const current = windowScore(input, input.today, weights, input.planGain)
  const previousEnd = addDays(input.today, -MOMENTUM_WINDOW_DAYS)
  const previous = windowScore(input, previousEnd, weights, input.previousPlanGain)

  const value = Math.round(current.value)
  const delta = value - Math.round(previous.value)
  const activeDays = activeDaysBetween(input, addDays(input.today, -(MOMENTUM_WINDOW_DAYS - 1)), input.today)
  const level = levelOf(value, delta, activeDays)

  const first = oldestDay(input)
  const hasEnoughData =
    first !== null && daysBetween(first, input.today) + 1 >= MIN_DAYS_FOR_FULL_SCORE

  const drivers = driversOf(current.parts, previous.parts, weights)

  return {
    value,
    level,
    delta,
    activeDays,
    activeDaysInHorizon: current.activeDays,
    parts: current.parts,
    basis: current.basis,
    hasEnoughData,
    drivers,
    headline: headlineFor(level, delta, drivers, hasEnoughData, value),
    explanation: explain(level, value, delta, activeDays),
  }
}

interface WindowScore {
  readonly value: number
  readonly activeDays: number
  readonly parts: MomentumParts
  readonly basis: MomentumBasis
}

/** Um fator: valor de 0 a 1, ou null quando não havia o que medir. */
type Factor = number | null

function windowScore(
  input: MomentumInput,
  end: DayKey,
  weights: MomentumWeights,
  gain: number | undefined,
): WindowScore {
  /*
    A janela começa no primeiro registro da conta, nunca antes dele — mas nunca
    é menor que uma semana.

    Quem tem duas semanas de app não pode ser medido contra 14 dias em que a
    conta não existia: aqueles dias não são falha, são ausência de história. Sem
    esse corte, o teto de uma conta nova seria 59 mesmo com tudo cumprido.

    O piso de sete dias existe pelo motivo inverso: sem ele, uma janela de um
    dia só faria "registrei hoje" empatar com "registrei todos os dias da
    semana", e a constância deixaria de significar qualquer coisa no começo —
    justamente quando ela é o hábito que precisa se formar.
  */
  const horizon = addDays(end, -(MOMENTUM_HORIZON_DAYS - 1))
  const shortest = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))
  const first = oldestDay(input)
  const start = first && first > horizon ? maxDay(horizon, minDay(first, shortest)) : horizon
  const days = dayRange(start, end)

  const credits = days.map((day) => dayCredit(input, day))
  const consistency = weightedAverage(days, credits, end)

  const priorities = prioritiesFactor(input, days, end)
  const objectives = objectivesFactor(gain)
  const recovery = recoveryFactor(credits, days)

  const parts: MomentumParts = {
    consistency,
    priorities: priorities ?? consistency,
    objectives: objectives ?? consistency,
    recovery: recovery ?? consistency,
  }

  const basis: MomentumBasis = {
    consistency: true,
    priorities: priorities !== null,
    objectives: objectives !== null,
    recovery: recovery !== null,
  }

  const value =
    (parts.consistency * weights.consistency +
      parts.priorities * weights.priorities +
      parts.objectives * weights.objectives +
      parts.recovery * weights.recovery) *
    100

  return {
    value: clamp01(value / 100) * 100,
    activeDays: credits.filter((credit) => credit > 0).length,
    parts,
    basis,
  }
}

/**
 * O peso de um dia dentro da janela: os últimos sete valem o triplo.
 *
 * É o que faz o número reagir ao que a pessoa fez esta semana sem apagar o mês
 * que ela construiu antes dele.
 */
function dayWeight(day: DayKey, end: DayKey): number {
  return daysBetween(day, end) < MOMENTUM_WINDOW_DAYS ? RECENT_DAY_WEIGHT : OLDER_DAY_WEIGHT
}

function weightedAverage(days: readonly DayKey[], values: readonly number[], end: DayKey): number {
  let total = 0
  let weight = 0
  days.forEach((day, index) => {
    const w = dayWeight(day, end)
    total += (values[index] ?? 0) * w
    weight += w
  })
  return weight === 0 ? 0 : clamp01(total / weight)
}

/**
 * O quanto de um dia foi cumprido, de 0 a 1.
 *
 * Soma o impacto do que saiu naquele dia — ações concluídas, hábitos cumpridos
 * e registros — cada categoria com o seu teto, e satura em `FULL_DAY_IMPACT`.
 * O teto por categoria é o que impede subir o número por repetição, e o teto do
 * dia é o que impede um sábado heroico valer por uma semana.
 */
function dayCredit(input: MomentumInput, day: DayKey): number {
  let habits = 0
  for (const log of input.habitLogs) {
    if (log.day !== day || !countsAsDone(log.status)) continue
    const habit = input.habits.find((item) => item.id === log.habitId)
    habits += habit ? impactPointsOf(habitImpact(habit)) : impactPointsOf('baixo')
  }

  let low = 0
  let high = 0
  for (const task of input.tasks) {
    if (task.day !== day || task.status !== 'feita') continue
    const level = taskImpact(task)
    if (level === 'baixo') low += impactPointsOf(level)
    else high += impactPointsOf(level)
  }

  const activities = input.activities.filter((activity) => activity.day === day).length

  const total =
    Math.min(habits, MAX_HABIT_IMPACT_PER_DAY) +
    Math.min(low, MAX_LOW_IMPACT_PER_DAY) +
    high +
    Math.min(activities, MAX_ACTIVITY_IMPACT_PER_DAY)

  if (total === 0) return 0

  /*
    Aparecer vale metade do dia; o tamanho do que saiu vale a outra metade.
    Só o impacto faria um dia de leitura curta valer 25% de um dia normal — e
    a mensagem do produto é a oposta: constância ganha de volume. Só a presença
    faria marcar um hábito de dois minutos valer o mesmo que fechar a etapa.
  */
  return clamp01(PRESENCE_CREDIT + (1 - PRESENCE_CREDIT) * (total / FULL_DAY_IMPACT))
}

/**
 * Execução das prioridades: do impacto que a pessoa planejou, quanto saiu.
 *
 * A razão é de IMPACTO, não de contagem: fechar a prioridade principal e deixar
 * duas tarefas comuns pendentes rende mais que o contrário. Ação cancelada sai
 * da conta inteira — largar conscientemente não é o mesmo que deixar pendente, e
 * punir a decisão ensina a pessoa a mentir pro app. Dia futuro também sai: ação
 * marcada pra amanhã ainda não é dívida.
 */
function prioritiesFactor(input: MomentumInput, days: readonly DayKey[], end: DayKey): Factor {
  const start = days[0]
  if (!start) return null

  let planned = 0
  let done = 0

  for (const task of input.tasks) {
    if (task.day < start || task.day > end) continue
    if (task.status === 'cancelada') continue

    const points = impactPointsOf(taskImpact(task))
    const weight = dayWeight(task.day, end)

    planned += points * weight
    if (task.status === 'feita') done += points * weight
  }

  if (planned === 0) return null
  return clamp01(done / planned)
}

/**
 * Progresso nos objetivos: o quanto o plano andou de verdade.
 *
 * Sem plano montado o fator não tem base e herda a consistência — cobrar avanço
 * de plano de quem ainda não tem plano seria punir a conta nova por uma etapa
 * que ela nem chegou a criar.
 */
function objectivesFactor(gain: number | undefined): Factor {
  if (gain === undefined) return null
  if (gain <= 0) return 0
  return clamp01(gain / PLAN_GAIN_CEILING)
}

/**
 * Capacidade de retomada: quanto tempo você leva pra voltar depois de parar.
 *
 * Cada pausa de dois dias ou mais vira uma nota pelo tempo que levou pra
 * fechar. Voltar no terceiro dia devolve quase tudo; sumir duas semanas, quase
 * nada. Pausa ainda aberta no fim da janela entra com a nota do tamanho que ela
 * já tem — senão bastaria continuar parado pra o fator nunca contar.
 *
 * Quem não parou não recebe nota cheia de graça: sem pausa nenhuma o fator não
 * tem base e herda a consistência, porque não houve retomada pra medir.
 *
 * A retomada mais recente pesa o dobro das anteriores — ver
 * `LATEST_RETURN_WEIGHT`. É por aí que voltar HOJE aparece no número.
 */
function recoveryFactor(credits: readonly number[], days: readonly DayKey[]): Factor {
  // Nenhum movimento na janela inteira não é uma pausa, é ausência: não há
  // retomada pra medir, e cobrar uma daria nota a quem nunca começou.
  if (!credits.some((credit) => credit > 0)) return null

  const notes: number[] = []
  let running = 0
  let started = false

  days.forEach((_, index) => {
    const moved = (credits[index] ?? 0) > 0
    if (moved) {
      // Só conta pausa depois do primeiro movimento: os dias anteriores ao
      // primeiro registro não são uma parada, são a conta ainda sem história.
      if (started && running >= GAP_FOR_RECOVERY) notes.push(recoveryNote(running))
      running = 0
      started = true
      return
    }
    if (started) running += 1
  })

  // Pausa ainda aberta: conta com a nota do tamanho atual, sem retorno.
  if (running >= GAP_FOR_RECOVERY) notes.push(recoveryNote(running + 1))

  if (notes.length === 0) return null

  /*
    Média com a última retomada pesando o dobro.

    É o que faz o Modo Retomada valer alguma coisa no número: a pessoa que
    escolhe um passo pequeno e volta hoje fecha a pausa aberta com a melhor
    nota possível, e essa nota é a que mais conta. Continua sendo dado real —
    o crédito só existe se houve movimento de verdade no dia.
  */
  let total = 0
  let weight = 0
  notes.forEach((note, index) => {
    const w = index === notes.length - 1 ? LATEST_RETURN_WEIGHT : 1
    total += note * w
    weight += w
  })

  return clamp01(total / weight)
}

/**
 * A nota de um retorno pelo tamanho da pausa que ele fechou.
 *
 * Cai rápido no começo e devagar depois: a diferença entre voltar no terceiro e
 * no quinto dia importa muito mais que a diferença entre o décimo e o décimo
 * segundo — ali a pessoa já saiu da rotina de qualquer jeito.
 */
function recoveryNote(gapDays: number): number {
  if (gapDays <= 2) return 1
  if (gapDays === 3) return 0.8
  if (gapDays === 4) return 0.6
  if (gapDays <= 6) return 0.4
  if (gapDays <= 10) return 0.25
  return 0.1
}

function activeDaysBetween(input: MomentumInput, start: DayKey, end: DayKey): number {
  return dayRange(start, end).filter((day) => dayCredit(input, day) > 0).length
}

function oldestDay(input: MomentumInput): DayKey | null {
  const days = [
    ...input.activities.map((item) => item.day),
    ...input.habitLogs.map((item) => item.day),
    ...input.tasks.map((item) => item.day),
  ].sort()
  return days[0] ?? null
}

function minDay(a: DayKey, b: DayKey): DayKey {
  return a <= b ? a : b
}

function maxDay(a: DayKey, b: DayKey): DayKey {
  return a >= b ? a : b
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * O que mexeu no número desde a semana passada, em pontos do score.
 *
 * É a informação que transforma a variação em decisão: "-6" não diz o que
 * fazer, "a execução das prioridades caiu 6 pontos" diz.
 */
function driversOf(
  current: MomentumParts,
  previous: MomentumParts,
  weights: MomentumWeights,
): MomentumDriver[] {
  return (Object.keys(weights) as MomentumPartKey[])
    .map((key) => ({
      key,
      label: MOMENTUM_PART_LABELS[key],
      delta: Math.round((current[key] - previous[key]) * weights[key] * 100),
    }))
    .filter((driver) => driver.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

function levelOf(value: number, delta: number, activeDays: number): MomentumLevel {
  // Subir depois de um período parado é "retomando", mesmo com pontuação baixa:
  // é a informação que faz a pessoa continuar.
  if (delta >= 8 && value < 55) return 'retomando'
  if (value >= 70) return 'avancando'
  if (delta <= -8 || activeDays <= 2) return 'desacelerando'
  if (value >= 45) return 'constante'
  return delta > 0 ? 'retomando' : 'desacelerando'
}

/**
 * A frase curta que acompanha o número.
 *
 * Personalizada pelo que de fato mudou: cita o fator que mais mexeu, com nome,
 * em vez de repetir uma frase de encorajamento que serve pra qualquer um.
 */
function headlineFor(
  level: MomentumLevel,
  delta: number,
  drivers: readonly MomentumDriver[],
  hasEnoughData: boolean,
  value: number,
): string {
  if (!hasEnoughData) {
    return value === 0
      ? 'Ainda sem registro pra medir teu ritmo. O primeiro movimento começa a curva.'
      : 'Teu ritmo ainda está se formando: uma semana de registro e o número passa a valer.'
  }

  const top = drivers[0]
  const name = top ? top.label.toLowerCase() : null

  if (delta > 0 && name) return `Subiu ${delta} pontos, puxado por ${name}.`
  if (delta < 0 && name) return `Caiu ${Math.abs(delta)} pontos, e o que mais pesou foi ${name}.`

  switch (level) {
    case 'avancando':
      return 'Ritmo alto e estável. Segura o que já está de pé.'
    case 'constante':
      return 'Mesmo ponto da semana passada. Constância é isso.'
    case 'retomando':
      return 'O movimento voltou. Ainda é cedo pra cobrar volume.'
    case 'desacelerando':
      return 'Semana mais quieta que a anterior. Uma ação já muda a curva.'
  }
}

function explain(
  level: MomentumLevel,
  value: number,
  delta: number,
  activeDays: number,
): string {
  const comparison =
    delta === 0
      ? 'no mesmo ponto da semana passada'
      : delta > 0
        ? `${delta} pontos acima da semana passada`
        : `${Math.abs(delta)} pontos abaixo da semana passada`

  const presence = `Você se moveu em ${activeDays} dos últimos ${MOMENTUM_WINDOW_DAYS} dias`

  switch (level) {
    case 'avancando':
      return `${presence} e está ${comparison}. O ritmo está alto e sustentável.`
    case 'constante':
      return `${presence} e está ${comparison}. Constância é exatamente o que faz o número subir.`
    case 'retomando':
      return `${presence} e está ${comparison}. O movimento voltou, ainda é cedo pra cobrar volume.`
    case 'desacelerando':
      return value === 0
        ? 'Ainda não há registro suficiente pra medir teu ritmo. O primeiro movimento resolve isso.'
        : `${presence} e está ${comparison}. Nada quebrado: um dia registrado já muda essa curva.`
  }
}

/**
 * A recomendação prática. Depende do ritmo E da capacidade de hoje: em dia de
 * baixa energia o app sugere a versão mínima em vez de empurrar o plano cheio.
 */
export function recommendationFor(score: MomentumScore, capacity: CapacityProfile): string {
  if (capacity.preferMinimal) {
    return score.level === 'desacelerando'
      ? 'Hoje não é dia de compensar. Faz a versão mínima da tua prioridade e encerra o dia em paz.'
      : 'Energia baixa com ritmo bom: mantém a versão mínima e preserva a sequência.'
  }

  switch (score.level) {
    case 'avancando':
      return 'Ritmo alto: usa o dia pra avançar na meta mais parada, não pra adicionar mais coisa.'
    case 'constante':
      return 'Conclui a prioridade principal antes de abrir qualquer outra frente.'
    case 'retomando':
      return 'Você está retomando o ritmo. Não tenta compensar tudo hoje: conclui a prioridade principal e preserva a sequência.'
    case 'desacelerando':
      return 'Escolhe uma ação só e faz ela pequena. Voltar é mais importante que acertar o tamanho.'
  }
}

export interface MomentumFactor {
  readonly key: MomentumPartKey
  readonly label: string
  readonly hint: string
  /** 0 a 1: quanto desse fator a pessoa cumpriu. */
  readonly value: number
  /** O mesmo fator normalizado de 0 a 100, que é como a tela mostra. */
  readonly score: number
  /** Pontos que esse fator entregou dos 100. */
  readonly points: number
  /** Máximo que ele poderia entregar. */
  readonly maxPoints: number
  /** Peso em porcentagem, pro detalhamento não depender de decorar a fórmula. */
  readonly weightPercent: number
  /** Falso quando não havia o que medir e o fator herdou a consistência. */
  readonly measured: boolean
}

/**
 * O score aberto em fatores. Existe pro número não ser um oráculo: a pessoa
 * precisa ver de onde vieram os pontos pra saber o que mexer amanhã.
 */
export function momentumFactors(
  score: MomentumScore,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumFactor[] {
  const keys = Object.keys(weights) as MomentumPartKey[]
  const exact = keys.map((key) => score.parts[key] * weights[key] * 100)
  const points = distributePoints(exact, score.value)

  return keys.map((key, index) => ({
    key,
    label: MOMENTUM_PART_LABELS[key],
    hint: MOMENTUM_PART_HINTS[key],
    value: score.parts[key],
    score: Math.round(score.parts[key] * 100),
    points: points[index] ?? 0,
    maxPoints: Math.round(weights[key] * 100),
    weightPercent: Math.round(weights[key] * 100),
    measured: score.basis[key],
  }))
}

/**
 * Reparte os pontos entre os fatores de modo que a soma bata com o score.
 *
 * Arredondar cada fator por conta própria produz um detalhamento que soma 47
 * embaixo de um número 46 — e um detalhamento que não fecha com o número é pior
 * que não ter detalhamento: ensina que a conta da tela não é confiável.
 *
 * O resto vai pros maiores restos decimais, que é a repartição que menos
 * distorce cada linha individualmente.
 */
function distributePoints(exact: readonly number[], total: number): number[] {
  const floors = exact.map((value) => Math.floor(value))
  let remaining = total - floors.reduce((sum, value) => sum + value, 0)

  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest)

  const points = [...floors]
  for (const { index } of order) {
    if (remaining <= 0) break
    points[index] = (points[index] ?? 0) + 1
    remaining -= 1
  }
  return points
}

/** O fator que mais deixou pontos na mesa. É o que vira sugestão de ajuste. */
export function weakestFactor(
  score: MomentumScore,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumFactor | null {
  const gaps = momentumFactors(score, weights)
    .map((factor) => ({ factor, gap: factor.maxPoints - factor.points }))
    .sort((a, b) => b.gap - a.gap)

  const worst = gaps[0]
  return worst && worst.gap > 0 ? worst.factor : null
}

/**
 * A evolução do score, um ponto por dia.
 *
 * Cada ponto é o score REAL daquele dia — a mesma função, com a janela
 * terminando ali. Guardar um histórico à parte abriria a porta pra a curva
 * discordar do número grande depois de qualquer ajuste na fórmula.
 *
 * O ganho de plano não é reconstruído dia a dia (ele vem de fora, já apurado),
 * então a curva usa o valor atual pro fator de objetivos. É a única
 * aproximação daqui, e ela move a linha inteira junto, sem distorcer a forma.
 */
export function momentumHistory(
  input: MomentumInput,
  days = 14,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumPoint[] {
  const start = addDays(input.today, -(days - 1))

  return dayRange(start, input.today).map((day) => ({
    day,
    value: Math.round(windowScore(input, day, weights, input.planGain).value),
  }))
}

export interface DayDot {
  readonly day: DayKey
  /** 0 a 1: o quanto do dia foi cumprido. */
  readonly intensity: number
  readonly minutes: number
  readonly habitsDone: number
  readonly tasksDone: number
}

/** Os últimos sete dias em forma de série, pro gráfico do progresso semanal. */
export function dailySeries(input: MomentumInput, end: DayKey = input.today): DayDot[] {
  const start = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))

  return dayRange(start, end).map((day) => {
    const minutes = totalMinutes(input.activities.filter((activity) => activity.day === day))
    const habitsDone = input.habitLogs.filter(
      (log) => log.day === day && countsAsDone(log.status),
    ).length
    const tasksDone = input.tasks.filter(
      (task) => task.day === day && task.status === 'feita',
    ).length

    /*
      A intensidade da barra é o mesmo crédito que o score usa: duas contas
      diferentes pro mesmo dia fariam o gráfico discordar do número logo acima
      dele, que é como um app começa a discordar de si mesmo.
    */
    const intensity = dayCredit(input, day)

    return { day, intensity: Number(intensity.toFixed(2)), minutes, habitsDone, tasksDone }
  })
}

/** Exportado pro gráfico e pros testes: o crédito de um dia, de 0 a 1. */
export function creditOfDay(input: MomentumInput, day: DayKey): number {
  return dayCredit(input, day)
}

export type { ImpactLevel }
export { habitImpact, IMPACT_LABELS, IMPACT_POINTS, taskImpact } from './momentum-impact'
