import type { Activity } from './activity'
import { totalMinutes } from './activity'
import type { CapacityProfile } from './checkin'
import { addDays, dayKeyToDate, dayRange, daysBetween, type DayKey } from './day'
import { countsAsDone, type Habit, type HabitLog } from './habit'
import { habitImpact, impactPointsOf, taskImpact, type ImpactLevel } from './momentum-impact'
import { type Task } from './task'
import type { WeeklyReview } from './weekly-review'

/**
 * Momentum Score: o ritmo da pessoa, não a nota dela.
 *
 * ## A fórmula oficial
 *
 *   Score = consistência × 0,35 + prioridades × 0,30 + progresso × 0,20 + retomada × 0,15
 *
 * Cada fator é normalizado entre 0 e 100 antes de entrar na média, e o
 * resultado fica entre 0 e 100. Os pesos moram em `DEFAULT_MOMENTUM_WEIGHTS`
 * e são a ÚNICA coisa a mexer numa recalibragem.
 *
 *   Consistência recente ....... 35%  cumprimento nos últimos 28 dias, os
 *                                     últimos 7 pesando o triplo
 *   Execução das prioridades ... 30%  do impacto planejado, quanto saiu
 *                                     (baixo 1, médio 2, alto 3)
 *   Progresso nos objetivos .... 20%  avanço do plano no ritmo que o prazo pede
 *   Capacidade de retomada ..... 15%  quanto tempo leva pra voltar depois de parar
 *
 * ## A janela é de 28 dias, com a última semana pesando mais
 *
 * Sete dias sozinhos transformam o número num termômetro de humor: uma gripe
 * derruba o score inteiro. Vinte e oito dias sozinhos fazem o contrário: a
 * pessoa muda hoje e o número não reage. A saída é a janela longa com peso:
 * cada um dos últimos sete dias vale o triplo dos vinte e um anteriores, o que
 * faz a semana atual responder por metade do score.
 *
 * ## O que conta é impacto, não quantidade
 *
 * Cada coisa concluída vale 1, 2 ou 3 (ver `momentum-impact`). Hábito tem
 * teto em 2, e cada categoria tem teto por dia. Sem os tetos, criar hábitos
 * fáceis vira a maneira mais rápida de subir o número.
 *
 * ## O que cada estado faz com o número
 *
 *   concluída ........ soma o impacto ao dia (crédito) e à execução das prioridades
 *   pendente hoje .... neutra: o dia ainda está aberto
 *   vencida .......... planejada e não feita; reduz a execução das prioridades
 *   adiada ........... custa metade de uma vencida: adiar é decisão, ignorar não
 *   cancelada ........ sai da conta inteira
 *   dia de descanso .. sai da conta se ficou vazio; conta normal se teve movimento
 *
 * ## O número não pula
 *
 * O score exibido sobe no máximo `MAX_DAILY_RISE` e cai no máximo
 * `MAX_DAILY_DROP` pontos por dia. O valor bruto continua sendo calculado, e a
 * diferença entre os dois é dita em voz alta (`heldBack`). Um dia ruim
 * nunca zera o número, e a pontuação nunca vira punição.
 *
 * ## Retomar é recompensado sem apagar a pausa
 *
 * A pausa continua na janela de 28 dias (a consistência lembra dela), mas o
 * retorno rápido devolve a nota cheia no fator de retomada, e a volta mais
 * recente pesa o dobro das anteriores.
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
 * propósito. Com teto 3, marcar três hábitos fáceis empataria com fechar a
 * ação que destrava a etapa. Em 2, a prioridade ganha sempre.
 */
const MAX_HABIT_IMPACT_PER_DAY = 2

/** Teto da tarefa comum por dia, pelo mesmo motivo e com a mesma régua. */
const MAX_LOW_IMPACT_PER_DAY = 2

/** Teto do registro avulso por dia: quem registra dez leituras não fez dez. */
const MAX_ACTIVITY_IMPACT_PER_DAY = 2

/** Quanto do dia vale só por ter tido movimento, antes de olhar o tamanho. */
const PRESENCE_CREDIT = 0.5

/**
 * Quanto uma ação adiada pesa contra a pessoa, comparada a uma vencida.
 *
 * Adiar é decisão: a pessoa olhou pra ação e disse "não hoje". Ignorar é a
 * ação vencer sem ninguém olhar. Cobrar as duas igual ensina que não vale a
 * pena decidir — e zerar a adiada ensina que adiar é grátis.
 */
export const POSTPONED_WEIGHT = 0.5

/**
 * Teto da execução das prioridades quando nada de impacto médio ou alto foi
 * planejado na janela.
 *
 * Sem ele, uma lista só de tarefas fáceis 100% cumprida marcaria 100 no fator
 * "execução das prioridades" — de quem nunca definiu uma prioridade. O teto é
 * a diferença entre "cumpri o que planejei" e "planejei o que importa".
 */
export const PRIORITIES_CAP_WITHOUT_PRIORITY = 0.7

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
 * agora. O peso é 2 e não mais: acima disso o fator vira termômetro de um dia
 * só, que é o defeito que a janela de 28 dias existe pra evitar.
 */
const LATEST_RETURN_WEIGHT = 2

/** Dias de história a partir dos quais o score deixa de ser parcial. */
const MIN_DAYS_FOR_FULL_SCORE = 7

/**
 * Quanto o score EXIBIDO pode subir e cair de um dia pro outro.
 *
 * Subir mais rápido que cair é de propósito: a retomada precisa aparecer na
 * tela no dia em que acontece, e a queda precisa dar tempo de reagir antes de
 * virar um número que assusta. Nenhum dos dois esconde o valor bruto — ele
 * continua em `rawValue`, e a diferença aparece como "ainda a absorver".
 */
export const MAX_DAILY_RISE = 6
export const MAX_DAILY_DROP = 4

/**
 * Quantos dias a suavização olha pra trás pra chegar no valor de hoje.
 *
 * O número exibido depende do de ontem, que depende do de anteontem. Recuar
 * oito semanas é o suficiente pra qualquer diferença entre o bruto e o
 * exibido já ter sido absorvida antes da janela do score começar.
 */
const SMOOTHING_SPAN_DAYS = 56

/**
 * Quantos dias de descanso planejado cabem numa semana.
 *
 * Dois, e não mais: acima disso "descanso" vira a maneira de tirar da conta os
 * dias em que não se quer ser medido. Dois dias por semana é fim de semana —
 * o único descanso que o produto precisa reconhecer sem discutir.
 */
export const MAX_REST_WEEKDAYS = 2

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
    'Em quantos dias você moveu alguma coisa nos últimos 28, com os últimos sete pesando o triplo. Dia de descanso planejado não conta contra.',
  priorities:
    'Do que você planejou, quanto saiu — medido por impacto: prioridade e ação de objetivo valem mais que tarefa comum. Ação vencida pesa, adiada pesa metade, cancelada não pesa.',
  objectives:
    'O quanto o plano dos teus objetivos andou de verdade no período, comparado com o ritmo que o prazo pede.',
  recovery:
    'Depois de parar, quanto tempo você leva pra voltar. Voltar em até dois dias devolve tudo, e a volta mais recente é a que mais conta.',
}

/** A fórmula em uma linha, pra tela e pra IA dizerem a mesma coisa. */
export const MOMENTUM_FORMULA =
  'Score = consistência × 0,35 + prioridades × 0,30 + progresso × 0,20 + retomada × 0,15'

export interface MomentumRule {
  readonly title: string
  readonly detail: string
}

/**
 * "Como seu score é calculado", em regras curtas.
 *
 * É a mesma lista pro diálogo do dashboard, pro progresso e pro contexto da
 * Momentumm AI. Uma explicação em cada lugar seria três explicações que
 * divergem na primeira recalibragem.
 */
export const MOMENTUM_RULES: readonly MomentumRule[] = [
  {
    title: 'Quatro fatores, um número',
    detail: `${MOMENTUM_FORMULA}. Cada fator vai de 0 a 100 antes de entrar na conta.`,
  },
  {
    title: `${MOMENTUM_HORIZON_DAYS} dias, os últimos ${MOMENTUM_WINDOW_DAYS} valendo o triplo`,
    detail:
      'Um dia ruim não apaga um mês de trabalho, e uma semana boa aparece na hora.',
  },
  {
    title: 'Impacto, não quantidade',
    detail:
      'Prioridade principal e ação de alta em um objetivo valem 3, ação de objetivo vale 2, tarefa comum e hábito valem 1. Hábitos e tarefas comuns têm teto por dia: repetir o fácil não sobe o número.',
  },
  {
    title: 'Concluir soma, vencer desconta, adiar custa metade',
    detail:
      'Ação vencida pesa contra a execução. Ação adiada pesa metade, porque adiar é uma decisão. Cancelada sai da conta. O que ainda é de hoje não pesa: o dia está aberto. Semana sem nenhuma ação planejada deixa o fator sem base.',
  },
  {
    title: 'Descanso planejado não é falta',
    detail: `Até ${MAX_REST_WEEKDAYS} dias por semana marcados como descanso saem da conta quando ficam vazios. Se você se mover num dia de descanso, ele conta normalmente.`,
  },
  {
    title: `Sobe até ${MAX_DAILY_RISE} e cai até ${MAX_DAILY_DROP} pontos de um dia pro outro`,
    detail:
      'O número que você vê é uma média móvel com a variação limitada em relação ao dia anterior. O valor bruto continua sendo calculado, e o que falta absorver fica visível.',
  },
  {
    title: 'Voltar conta, e a pausa fica na história',
    detail:
      'Voltar em até dois dias devolve a nota cheia de retomada, e a volta mais recente pesa o dobro. A pausa continua na janela de 28 dias: o número recompensa a volta sem fingir que ela não aconteceu.',
  },
  {
    title: 'Conta nova mede só o que existe',
    detail: `A janela começa no teu primeiro registro. Com menos de ${MIN_DAYS_FOR_FULL_SCORE} dias de história o número aparece como "ainda se formando", e fator sem dados acompanha a consistência em vez de valer zero.`,
  },
]

export interface MomentumInput {
  readonly activities: readonly Activity[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly tasks: readonly Task[]
  readonly today: DayKey
  /** Reviews escritos. Não entram no score; ficam pro resto do app. */
  readonly weeklyReviews?: readonly WeeklyReview[]
  /**
   * Dias da semana de descanso planejado (0 = domingo). No máximo
   * `MAX_REST_WEEKDAYS`; o excedente é ignorado.
   */
  readonly restWeekdays?: readonly number[] | undefined
  /**
   * Progresso de plano ganho na janela atual e na anterior, de 0 a 1.
   *
   * Vem de fora porque depende de etapas, e o momentum não conhece a
   * hierarquia. Undefined deixa o fator sem base, e aí ele herda a
   * consistência em vez de zerar: conta sem plano montado não é conta parada.
   */
  readonly planGain?: number
  readonly previousPlanGain?: number
  /**
   * O ganho de plano da janela que termina em qualquer dia. Quando existe,
   * substitui os dois acima e faz o histórico e a suavização enxergarem o
   * avanço real de cada dia, em vez de repetir o de hoje pra trás.
   */
  readonly planGainAt?: ((end: DayKey) => number | undefined) | undefined
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
  /** 0 a 100: o número exibido, já com o limite de variação diária. */
  readonly value: number
  /** 0 a 100: o mesmo cálculo sem o limite diário. */
  readonly rawValue: number
  /**
   * Pontos que o número exibido ainda não absorveu: positivo quando o bruto
   * está acima (ainda vai subir), negativo quando está abaixo (ainda vai cair).
   */
  readonly heldBack: number
  readonly level: MomentumLevel
  /** Diferença em pontos contra o número exibido sete dias atrás. */
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
  const prepared = prepare(input, weights)
  const series = smoothedSeries(prepared, input.today)

  const current = series.get(input.today) ?? emptyPoint()
  const previous = series.get(addDays(input.today, -MOMENTUM_WINDOW_DAYS)) ?? emptyPoint()

  const value = Math.round(current.value)
  const rawValue = Math.round(current.raw.value)
  const delta = value - Math.round(previous.value)
  const activeDays = activeDaysBetween(
    prepared,
    addDays(input.today, -(MOMENTUM_WINDOW_DAYS - 1)),
    input.today,
  )
  const level = levelOf(value, delta, activeDays)

  const hasEnoughData =
    prepared.first !== null &&
    daysBetween(prepared.first, input.today) + 1 >= MIN_DAYS_FOR_FULL_SCORE

  const drivers = driversOf(current.raw.parts, previous.raw.parts, weights)

  return {
    value,
    rawValue,
    heldBack: rawValue - value,
    level,
    delta,
    activeDays,
    activeDaysInHorizon: current.raw.activeDays,
    parts: current.raw.parts,
    basis: current.raw.basis,
    hasEnoughData,
    drivers,
    headline: headlineFor(level, delta, drivers, hasEnoughData, value),
    explanation: explain(level, value, delta, activeDays),
  }
}

// ---------------------------------------------------------------------------
// preparação: o que todo cálculo precisa e nenhum precisa refazer
// ---------------------------------------------------------------------------

interface Prepared {
  readonly input: MomentumInput
  readonly weights: MomentumWeights
  readonly restWeekdays: ReadonlySet<number>
  /** O primeiro dia com registro na conta, ou null. */
  readonly first: DayKey | null
  /** Crédito de cada dia, calculado uma vez por cálculo. */
  readonly credits: Map<DayKey, number>
}

function prepare(input: MomentumInput, weights: MomentumWeights): Prepared {
  return {
    input,
    weights,
    restWeekdays: new Set(normalizeRestWeekdays(input.restWeekdays ?? [])),
    first: oldestDay(input),
    credits: new Map(),
  }
}

/** Só dias válidos, sem repetição, e nunca mais que `MAX_REST_WEEKDAYS`. */
export function normalizeRestWeekdays(weekdays: readonly number[]): number[] {
  const valid = [...new Set(weekdays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  return valid.sort((a, b) => a - b).slice(0, MAX_REST_WEEKDAYS)
}

function isRestDay(prepared: Prepared, day: DayKey): boolean {
  if (prepared.restWeekdays.size === 0) return false
  return prepared.restWeekdays.has(dayKeyToDate(day).getDay())
}

function creditAt(prepared: Prepared, day: DayKey): number {
  const cached = prepared.credits.get(day)
  if (cached !== undefined) return cached
  const credit = dayCredit(prepared.input, day)
  prepared.credits.set(day, credit)
  return credit
}

// ---------------------------------------------------------------------------
// o score bruto de uma janela
// ---------------------------------------------------------------------------

interface WindowScore {
  readonly value: number
  readonly activeDays: number
  readonly parts: MomentumParts
  readonly basis: MomentumBasis
}

/** Um fator: valor de 0 a 1, ou null quando não havia o que medir. */
type Factor = number | null

function windowScore(prepared: Prepared, end: DayKey): WindowScore {
  const { input, weights } = prepared

  /*
    A janela começa no primeiro registro da conta, nunca antes dele — mas nunca
    é menor que uma semana.

    Quem tem duas semanas de app não pode ser medido contra 14 dias em que a
    conta não existia: aqueles dias não são falha, são ausência de história.
    O piso de sete dias existe pelo motivo inverso: sem ele, "registrei hoje"
    empataria com "registrei todos os dias da semana".
  */
  const horizon = addDays(end, -(MOMENTUM_HORIZON_DAYS - 1))
  const shortest = addDays(end, -(MOMENTUM_WINDOW_DAYS - 1))
  const first = prepared.first
  const start = first && first > horizon ? maxDay(horizon, minDay(first, shortest)) : horizon
  const days = dayRange(start, end)

  const credits = days.map((day) => creditAt(prepared, day))
  const rest = days.map((day) => isRestDay(prepared, day))

  const consistency = consistencyFactor(days, credits, rest, end)
  const priorities = prioritiesFactor(prepared, days, rest, end)
  const objectives = objectivesFactor(planGainFor(input, end))
  const recovery = recoveryFactor(credits, rest)

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
    parts.consistency * weights.consistency +
    parts.priorities * weights.priorities +
    parts.objectives * weights.objectives +
    parts.recovery * weights.recovery

  return {
    value: clamp01(value) * 100,
    activeDays: credits.filter((credit) => credit > 0).length,
    parts,
    basis,
  }
}

/**
 * O ganho de plano da janela que termina em `end`.
 *
 * Com `planGainAt` a resposta é exata pra qualquer dia. Sem ele, o que existe
 * são dois números: o de hoje e o de uma semana atrás, e cada dia usa o mais
 * próximo dele.
 */
function planGainFor(input: MomentumInput, end: DayKey): number | undefined {
  if (input.planGainAt) return input.planGainAt(end)
  return daysBetween(end, input.today) >= MOMENTUM_WINDOW_DAYS
    ? input.previousPlanGain
    : input.planGain
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

/**
 * Consistência: a média ponderada do crédito de cada dia.
 *
 * Dia de descanso planejado que ficou vazio sai da média — nem soma, nem
 * divide. Dia de descanso com movimento entra normal: descansar é direito,
 * não obrigação.
 */
function consistencyFactor(
  days: readonly DayKey[],
  credits: readonly number[],
  rest: readonly boolean[],
  end: DayKey,
): number {
  let total = 0
  let weight = 0
  days.forEach((day, index) => {
    const credit = credits[index] ?? 0
    if (rest[index] && credit === 0) return
    const w = dayWeight(day, end)
    total += credit * w
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

  let activities = 0
  for (const activity of input.activities) {
    if (activity.day === day) activities += 1
  }

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
 * duas tarefas comuns pendentes rende mais que o contrário.
 *
 *   feita ............ planejada e cumprida
 *   vencida .......... planejada, não cumprida (pendente com o dia já passado)
 *   adiada ........... planejada com peso `POSTPONED_WEIGHT`, não cumprida
 *   cancelada ........ fora da conta: largar conscientemente não é falhar
 *   pendente no dia .. fora da conta: o dia ainda está aberto
 *   futura ........... fora da conta: ainda não é dívida
 *   dia de descanso .. pendente em dia de descanso não é cobrada
 *
 * E sem nada de impacto médio ou alto planejado na janela, o fator não passa
 * de `PRIORITIES_CAP_WITHOUT_PRIORITY`: cumprir só o fácil não é executar
 * prioridade.
 *
 * Sem NENHUMA ação planejada na última semana o fator não tem base e herda a
 * consistência. Uma razão de três semanas atrás carregando 30% do score de
 * quem parou de planejar seria a execução perfeita de quem não executa nada.
 */
function prioritiesFactor(
  prepared: Prepared,
  days: readonly DayKey[],
  rest: readonly boolean[],
  end: DayKey,
): Factor {
  const start = days[0]
  if (!start) return null

  let planned = 0
  let done = 0
  let hasPriority = false
  let hasRecentPlan = false

  for (const task of prepared.input.tasks) {
    if (task.day < start || task.day > end) continue
    if (task.status === 'cancelada') continue

    const level = taskImpact(task)
    const points = impactPointsOf(level)
    const weight = dayWeight(task.day, end)
    if (weight === RECENT_DAY_WEIGHT) hasRecentPlan = true

    if (task.status === 'feita') {
      planned += points * weight
      done += points * weight
      if (level !== 'baixo') hasPriority = true
      continue
    }

    if (task.status === 'adiada') {
      planned += points * weight * POSTPONED_WEIGHT
      if (level !== 'baixo') hasPriority = true
      continue
    }

    // pendente ou em andamento: só vira dívida depois que o dia fecha.
    if (task.day >= end) continue
    if (rest[daysBetween(start, task.day)]) continue

    planned += points * weight
    if (level !== 'baixo') hasPriority = true
  }

  if (planned === 0 || !hasRecentPlan) return null

  const ratio = clamp01(done / planned)
  return hasPriority ? ratio : Math.min(ratio, PRIORITIES_CAP_WITHOUT_PRIORITY)
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
 * fechar. Pausa ainda aberta no fim da janela entra com a nota do tamanho que
 * ela já tem — senão bastaria continuar parado pra o fator nunca contar.
 *
 * Dia de descanso vazio é transparente: não abre pausa, não alonga pausa e não
 * fecha pausa. Quem não parou não recebe nota cheia de graça: sem pausa nenhuma
 * o fator não tem base e herda a consistência.
 *
 * A retomada mais recente pesa o dobro das anteriores — ver
 * `LATEST_RETURN_WEIGHT`. É por aí que voltar HOJE aparece no número.
 */
function recoveryFactor(credits: readonly number[], rest: readonly boolean[]): Factor {
  // Nenhum movimento na janela inteira não é uma pausa, é ausência: não há
  // retomada pra medir, e cobrar uma daria nota a quem nunca começou.
  if (!credits.some((credit) => credit > 0)) return null

  const notes: number[] = []
  let running = 0
  let started = false

  credits.forEach((credit, index) => {
    const moved = credit > 0
    if (moved) {
      // Só conta pausa depois do primeiro movimento: os dias anteriores ao
      // primeiro registro não são uma parada, são a conta ainda sem história.
      if (started && running >= GAP_FOR_RECOVERY) notes.push(recoveryNote(running))
      running = 0
      started = true
      return
    }
    if (rest[index]) return
    if (started) running += 1
  })

  // Pausa ainda aberta: conta com a nota do tamanho atual, sem retorno.
  if (running >= GAP_FOR_RECOVERY) notes.push(recoveryNote(running + 1))

  if (notes.length === 0) return null

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

// ---------------------------------------------------------------------------
// suavização: o número que a pessoa vê
// ---------------------------------------------------------------------------

interface SmoothedPoint {
  /** O valor exibido, já limitado pela variação diária. */
  readonly value: number
  readonly raw: WindowScore
}

function emptyPoint(): SmoothedPoint {
  const zero: MomentumParts = { consistency: 0, priorities: 0, objectives: 0, recovery: 0 }
  const none: MomentumBasis = {
    consistency: true,
    priorities: false,
    objectives: false,
    recovery: false,
  }
  return { value: 0, raw: { value: 0, activeDays: 0, parts: zero, basis: none } }
}

/**
 * A série exibida, dia a dia, até `end`.
 *
 * Cada ponto é o score bruto daquele dia puxado pra dentro do limite diário em
 * relação ao ponto anterior. A série começa no primeiro registro da conta (o
 * primeiro ponto é o bruto: não há ontem pra comparar) e nunca mais de
 * `SMOOTHING_SPAN_DAYS` atrás, que é o bastante pra qualquer diferença já ter
 * sido absorvida.
 */
function smoothedSeries(prepared: Prepared, end: DayKey): Map<DayKey, SmoothedPoint> {
  const series = new Map<DayKey, SmoothedPoint>()
  if (prepared.first === null) return series

  const span = addDays(end, -(SMOOTHING_SPAN_DAYS - 1))
  const start = maxDay(span, prepared.first)
  if (start > end) return series

  let previous: number | null = null
  for (const day of dayRange(start, end)) {
    const raw = windowScore(prepared, day)
    /*
      Na primeira semana da conta o número é o bruto, sem limite: ele está
      "se formando" e a tela diz isso. Limitar ali faria quem cumpre tudo
      desde o primeiro dia ver 40 no sétimo, e a explicação seria "porque
      ontem era 34" — uma regra de estabilidade aplicada a um número que
      ainda não existia.
    */
    const forming = daysBetween(prepared.first, day) + 1 < MIN_DAYS_FOR_FULL_SCORE
    const value: number =
      previous === null || forming
        ? raw.value
        : Math.min(previous + MAX_DAILY_RISE, Math.max(previous - MAX_DAILY_DROP, raw.value))
    series.set(day, { value, raw })
    previous = value
  }
  return series
}

function activeDaysBetween(prepared: Prepared, start: DayKey, end: DayKey): number {
  return dayRange(start, end).filter((day) => creditAt(prepared, day) > 0).length
}

/** O primeiro dia com registro na conta, ou null: antes dele não existe "parada". */
export function oldestDay(input: MomentumInput): DayKey | null {
  let first: DayKey | null = null
  const consider = (day: DayKey) => {
    if (first === null || day < first) first = day
  }
  for (const item of input.activities) consider(item.day)
  for (const item of input.habitLogs) consider(item.day)
  for (const item of input.tasks) consider(item.day)
  return first
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

// ---------------------------------------------------------------------------
// leitura: motivos, nível, frases
// ---------------------------------------------------------------------------

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

/**
 * A frase sobre o que o número ainda não absorveu. Null quando bruto e
 * exibido já são o mesmo — aí não há nada a explicar.
 */
export function heldBackNote(score: MomentumScore): string | null {
  if (score.heldBack >= 2) {
    return `O número sobe no máximo ${MAX_DAILY_RISE} pontos por dia: ainda há ${score.heldBack} a absorver do que você já fez.`
  }
  if (score.heldBack <= -2) {
    return `O número cai no máximo ${MAX_DAILY_DROP} pontos por dia: sem movimento, ainda vai cair ${Math.abs(score.heldBack)}. Uma ação hoje segura essa queda.`
  }
  return null
}

// ---------------------------------------------------------------------------
// o score aberto em fatores
// ---------------------------------------------------------------------------

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
 *
 * Os pontos são repartidos sobre o valor EXIBIDO: um detalhamento que soma 47
 * embaixo de um 46 ensina que a conta da tela não é confiável.
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
 * O total pode ser menor OU maior que a soma dos brutos por causa do limite
 * diário. A diferença vai pros fatores na ordem do maior resto decimal, um
 * ponto por vez, sem deixar nenhum negativo nem acima do máximo.
 */
function distributePoints(exact: readonly number[], total: number): number[] {
  const floors = exact.map((value) => Math.floor(value))
  let remaining = total - floors.reduce((sum, value) => sum + value, 0)

  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest)

  const points = [...floors]
  let guard = 0
  while (remaining !== 0 && guard < 400) {
    guard += 1
    const step = remaining > 0 ? 1 : -1
    const candidates = step > 0 ? order : [...order].reverse()
    let moved = false
    for (const { index } of candidates) {
      const current = points[index] ?? 0
      if (step < 0 && current <= 0) continue
      points[index] = current + step
      remaining -= step
      moved = true
      if (remaining === 0) break
    }
    if (!moved) break
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
 * Cada ponto é o score EXIBIDO daquele dia — a mesma série que produz o número
 * grande, com o mesmo limite diário. Guardar um histórico à parte abriria a
 * porta pra a curva discordar do número depois de qualquer ajuste na fórmula.
 */
export function momentumHistory(
  input: MomentumInput,
  days = 14,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumPoint[] {
  const prepared = prepare(input, weights)
  const series = smoothedSeries(prepared, input.today)
  const start = addDays(input.today, -(days - 1))

  return dayRange(start, input.today).map((day) => ({
    day,
    value: Math.round(series.get(day)?.value ?? 0),
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
