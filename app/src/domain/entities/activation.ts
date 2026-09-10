import { activityType, slugify, type ActivityTypeSlug } from './activity-type'
import { addDays, daysBetween, type DayKey } from './day'
import {
  buildPlan,
  comfortableSessionOf,
  MAX_DAYS_PER_WEEK,
  MAX_MINUTES_PER_DAY,
  MIN_DAYS_PER_WEEK,
  MIN_MINUTES_PER_DAY,
  type PlanDraft,
  type PlannedStage,
  type PlannedTask,
} from './plan-builder'
import { MAX_OBJECTIVE_DAYS, MIN_OBJECTIVE_DAYS } from './objective'

/**
 * Ativação: as quatro perguntas do primeiro acesso viradas em plano real.
 *
 * O onboarding antigo perguntava por EIXO ("leitura, estudo, treino,
 * meditação") — a linguagem do produto, não a da pessoa. Ninguém acorda
 * querendo "meditação": quer dormir melhor, quer sair do emprego, quer
 * terminar o curso. Aqui a primeira pergunta é a área da VIDA, e o eixo é
 * consequência dela.
 *
 * O fluxo é curto de propósito, porque a métrica que importa nessa tela é
 * ativação: quatro perguntas, um plano, um primeiro passo pra hoje.
 *
 *   1. O que você quer mudar?      → área da vida
 *   2. O que você quer alcançar?   → texto livre
 *   3. Quando?                     → prazo flexível ou data
 *   4. Quanto tempo, de verdade?   → horas por dia ou semana + dias
 *
 * ## A regra dura deste arquivo
 *
 * **Nunca devolver um plano impossível como pronto.** O gerador compara o que
 * o objetivo pede com o que a pessoa disse que tem e, quando não fecha, marca
 * `ready: false` e devolve saídas concretas — cada uma com o número que ela
 * produziria. Plano que só funciona no papel não é otimismo, é a primeira
 * frustração já agendada.
 */

// ---------------------------------------------------------------------------
// 1. a área da vida
// ---------------------------------------------------------------------------

export const LIFE_AREA_KEYS = [
  'saude',
  'carreira',
  'estudos',
  'projeto',
  'financas',
  'pessoal',
  'outro',
] as const
export type LifeAreaKey = (typeof LIFE_AREA_KEYS)[number]

export interface LifeArea {
  readonly key: LifeAreaKey
  readonly label: string
  readonly hint: string
  /** Chave de ícone resolvida na apresentação. O domínio não conhece SVG. */
  readonly icon: string
  /** Exemplo curto, usado como placeholder da pergunta seguinte. */
  readonly example: string
  /**
   * Eixo de fábrica equivalente, quando existe um com o mesmo significado.
   * Sem isso a área vira um eixo novo com o nome que a pessoa escolheu —
   * que é o que a arquitetura sempre prometeu: eixo novo é uma linha, não um
   * módulo.
   */
  readonly builtinAxis?: ActivityTypeSlug
}

export const LIFE_AREAS: readonly LifeArea[] = [
  {
    key: 'saude',
    label: 'Saúde',
    hint: 'Treino, sono, alimentação, energia.',
    icon: 'halter',
    example: 'Correr 5 km sem parar',
  },
  {
    key: 'carreira',
    label: 'Carreira',
    hint: 'Promoção, transição, portfólio, rede.',
    icon: 'subir',
    example: 'Montar um portfólio com 3 cases',
  },
  {
    key: 'estudos',
    label: 'Estudos',
    hint: 'Curso, prova, idioma, leitura técnica.',
    icon: 'cerebro',
    example: 'Terminar o curso que comecei',
    builtinAxis: 'estudo',
  },
  {
    key: 'projeto',
    label: 'Projeto',
    hint: 'Aquilo teu que está parado no papel.',
    icon: 'objetivo',
    example: 'Lançar a primeira versão',
  },
  {
    key: 'financas',
    label: 'Finanças',
    hint: 'Reserva, dívida, organização, renda.',
    icon: 'progresso',
    example: 'Montar a reserva de emergência',
  },
  {
    key: 'pessoal',
    label: 'Pessoal',
    hint: 'Relações, prática, rotina, cabeça.',
    icon: 'lotus',
    example: 'Voltar a tocar violão toda semana',
  },
  {
    key: 'outro',
    label: 'Outra',
    hint: 'Escreve a tua. Ela vira uma área de verdade.',
    icon: 'mais',
    example: 'O que você quer mudar',
  },
]

export function lifeArea(key: LifeAreaKey): LifeArea {
  return LIFE_AREAS.find((area) => area.key === key) ?? (LIFE_AREAS[0] as LifeArea)
}

export interface ResolvedArea {
  readonly label: string
  readonly axis: ActivityTypeSlug
  /** O eixo ainda não existe na conta e precisa ser criado ao salvar. */
  readonly needsAxis: boolean
}

/**
 * A área escolhida virando eixo.
 *
 * O eixo NÃO é criado aqui: o domínio não escreve. Ele devolve o slug que a
 * área terá e avisa quem grava. Isso mantém a prévia inteira funcionando sem
 * deixar uma linha órfã em `activity_types` pra quem desistir no meio.
 */
export function resolveArea(
  key: LifeAreaKey,
  customLabel: string,
  existingAxes: readonly ActivityTypeSlug[],
): ResolvedArea {
  const area = lifeArea(key)
  const label = key === 'outro' ? customLabel.trim() || area.label : area.label

  if (area.builtinAxis) {
    return { label: activityType(area.builtinAxis).label, axis: area.builtinAxis, needsAxis: false }
  }

  const slug = slugify(label)
  return { label, axis: slug, needsAxis: slug.length > 0 && !existingAxes.includes(slug) }
}

// ---------------------------------------------------------------------------
// 3. o prazo
// ---------------------------------------------------------------------------

/** Prazo usado quando a pessoa diz que ainda não sabe. Três meses cabe na cabeça. */
export const FLEXIBLE_DAYS = 90

export interface HorizonPreset {
  readonly key: string
  readonly days: number
  readonly label: string
}

export const HORIZON_PRESETS: readonly HorizonPreset[] = [
  { key: '30', days: 30, label: 'Em 1 mês' },
  { key: '60', days: 60, label: 'Em 2 meses' },
  { key: '90', days: 90, label: 'Em 3 meses' },
  { key: '180', days: 180, label: 'Em 6 meses' },
]

export type Horizon =
  | { readonly kind: 'flexivel' }
  | { readonly kind: 'preset'; readonly days: number }
  | { readonly kind: 'data'; readonly date: DayKey }

export interface ResolvedHorizon {
  readonly deadline: DayKey
  readonly days: number
  /** A pessoa não escolheu data: o app assumiu uma e diz isso em voz alta. */
  readonly assumed: boolean
  /** Preenchido quando a data escolhida está fora do que o domínio aceita. */
  readonly error: string | null
}

export function resolveHorizon(horizon: Horizon, today: DayKey): ResolvedHorizon {
  if (horizon.kind === 'data') {
    const days = daysBetween(today, horizon.date) + 1

    if (days < MIN_OBJECTIVE_DAYS) {
      return {
        deadline: addDays(today, MIN_OBJECTIVE_DAYS - 1),
        days: MIN_OBJECTIVE_DAYS,
        assumed: false,
        error: `Escolhe uma data com pelo menos ${MIN_OBJECTIVE_DAYS} dias. Abaixo disso não dá pra construir ritmo.`,
      }
    }

    if (days > MAX_OBJECTIVE_DAYS) {
      return {
        deadline: addDays(today, MAX_OBJECTIVE_DAYS - 1),
        days: MAX_OBJECTIVE_DAYS,
        assumed: false,
        error: 'Mais de um ano não vira plano. Escolhe um marco menor primeiro.',
      }
    }

    return { deadline: horizon.date, days, assumed: false, error: null }
  }

  const days = horizon.kind === 'preset' ? horizon.days : FLEXIBLE_DAYS
  return {
    deadline: addDays(today, days - 1),
    days,
    assumed: horizon.kind === 'flexivel',
    error: null,
  }
}

// ---------------------------------------------------------------------------
// 4. o tempo disponível
// ---------------------------------------------------------------------------

export type BudgetMode = 'dia' | 'semana'

export interface TimeBudget {
  readonly mode: BudgetMode
  /** Minutos por dia ou por semana, conforme o modo. */
  readonly minutes: number
  /** Dias da semana disponíveis (0 = domingo). Vazio significa nenhum escolhido. */
  readonly weekdays: readonly number[]
}

export interface ResolvedBudget {
  readonly minutesPerDay: number
  readonly daysPerWeek: number
  readonly weekdays: readonly number[]
  readonly minutesPerWeek: number
}

/** Sugestão de dias quando a pessoa ainda não marcou nenhum: segunda a sexta. */
export const DEFAULT_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5]

/**
 * O orçamento de tempo, sempre reduzido a "minutos por dia de sessão".
 *
 * Quem responde por semana não deveria ter que dividir de cabeça, e quem
 * responde por dia não deveria ter que multiplicar: as duas respostas chegam
 * aqui e saem na mesma unidade, que é a única que o gerador de plano entende.
 */
export function resolveBudget(budget: TimeBudget): ResolvedBudget {
  const weekdays = budget.weekdays.length > 0 ? [...budget.weekdays].sort((a, b) => a - b) : DEFAULT_WEEKDAYS
  const daysPerWeek = clamp(weekdays.length, MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK)

  const minutesPerDay =
    budget.mode === 'dia'
      ? clamp(Math.round(budget.minutes), MIN_MINUTES_PER_DAY, MAX_MINUTES_PER_DAY)
      : clamp(Math.round(budget.minutes / daysPerWeek), MIN_MINUTES_PER_DAY, MAX_MINUTES_PER_DAY)

  return {
    minutesPerDay,
    daysPerWeek,
    weekdays,
    minutesPerWeek: minutesPerDay * daysPerWeek,
  }
}

// ---------------------------------------------------------------------------
// a ambição declarada
// ---------------------------------------------------------------------------

export type QuantityPeriod = 'total' | 'dia' | 'semana'

export interface GoalQuantity {
  /** O número, já na unidade do eixo. */
  readonly value: number
  /** Se ele é o total do objetivo ou um ritmo. Muda tudo na conta. */
  readonly period: QuantityPeriod
}

/**
 * O número que a pessoa escreveu no objetivo, quando ela escreveu um.
 *
 * Lê só unidades que os eixos realmente medem — horas, minutos e páginas.
 * "Ler 6 livros" NÃO vira 1500 páginas: converter livro em página é chutar a
 * espessura do livro dela e apresentar o chute como plano. Sem número
 * reconhecível, o alvo sai do ritmo saudável do eixo, e a tela diz de onde
 * veio.
 *
 * O período importa tanto quanto o número. "Estudar 30 min por dia" é um
 * RITMO: tratar os 30 minutos como alvo total daria um objetivo de meia hora
 * pra três meses — e o plano nasceria ridículo em vez de errado por pouco.
 */
export function readGoalQuantity(text: string, axis: ActivityTypeSlug): GoalQuantity | null {
  const normalized = text.toLowerCase()
  const unit = activityType(axis).unit

  const value = unit === 'minutos' ? readMinutes(normalized) : readPages(normalized)
  if (value === null) return null

  return { value, period: readPeriod(normalized) }
}

function readMinutes(text: string): number | null {
  const hours = /(\d+(?:[.,]\d+)?)\s*(h\b|horas?\b)/.exec(text)
  if (hours?.[1]) return Math.round(Number(hours[1].replace(',', '.')) * 60)

  const minutes = /(\d+)\s*(min\b|minutos?\b)/.exec(text)
  return minutes?.[1] ? Number(minutes[1]) : null
}

function readPages(text: string): number | null {
  const pages = /(\d+)\s*(p[áa]ginas?\b|p[áa]gs?\b)/.exec(text)
  return pages?.[1] ? Number(pages[1]) : null
}

function readPeriod(text: string): QuantityPeriod {
  if (/(por|todo|cada)\s+dia\b|di[áa]ri/.test(text)) return 'dia'
  if (/(por|toda|cada)\s+semana\b|semanal/.test(text)) return 'semana'
  return 'total'
}

export type TargetSource = 'declarado' | 'ritmo' | 'ajustado'

// ---------------------------------------------------------------------------
// o plano de ativação
// ---------------------------------------------------------------------------

export const ACTIVATION_READY_MESSAGE =
  'Seu plano está pronto. Você não precisa resolver o objetivo inteiro hoje. Seu próximo passo é este.'

export const ACTIVATION_CTA = 'Começar meu Momentum'

export interface ActivationAnswers {
  readonly area: LifeAreaKey
  /** Nome escrito pela pessoa quando a área é "Outra". */
  readonly customArea: string
  /** O que ela quer alcançar, com as palavras dela. */
  readonly goal: string
  readonly horizon: Horizon
  readonly budget: TimeBudget
}

/**
 * Um ajuste aceito pela pessoa depois do aviso de ambição. Ele existe pra a
 * saída escolhida ser aplicada ao MESMO gerador, e não a uma segunda conta
 * paralela que poderia discordar da primeira.
 */
export interface ActivationAdjustment {
  readonly target?: number
  readonly daysPerWeek?: number
  readonly days?: number
}

export interface AmbitionCheck {
  readonly fits: boolean
  readonly requiredMinutesPerWeek: number
  readonly availableMinutesPerWeek: number
  /** A frase exata do aviso. Null quando o plano cabe. */
  readonly message: string | null
  /** De onde saíram os dois números, pra a conta ser conferível. */
  readonly basis: string
}

export const ACTIVATION_REMEDIES = ['reduzir', 'frequencia', 'prazo', 'manual'] as const
export type ActivationRemedyKey = (typeof ACTIVATION_REMEDIES)[number]

export interface ActivationRemedy {
  readonly key: ActivationRemedyKey
  readonly label: string
  /** O que ela faz, com o número que produz. */
  readonly detail: string
  /** O ajuste a aplicar. Ausente em "revisar manualmente". */
  readonly adjustment?: ActivationAdjustment
}

export interface ActivationPlan {
  readonly areaLabel: string
  readonly axis: ActivityTypeSlug
  readonly needsAxis: boolean
  readonly objectiveTitle: string
  readonly deadline: DayKey
  readonly assumedDeadline: boolean
  readonly budget: ResolvedBudget
  /** O plano de verdade, o mesmo que o resto do app gera e grava. */
  readonly plan: PlanDraft
  /** Os marcos do caminho. São as etapas que vão pro banco. */
  readonly milestones: readonly PlannedStage[]
  readonly actions: readonly PlannedTask[]
  /** A ação de hoje. É ela que a última tela mostra. */
  readonly firstStep: PlannedTask | null
  readonly target: number
  readonly targetSource: TargetSource
  readonly ambition: AmbitionCheck
  /** Saídas concretas quando não cabe. Vazio quando cabe. */
  readonly remedies: readonly ActivationRemedy[]
  /** Só com `true` o app tem permissão de gravar. */
  readonly ready: boolean
}

export interface ActivationInput {
  readonly answers: ActivationAnswers
  readonly today: DayKey
  /** Eixos que já existem na conta, pra saber se a área precisa ser criada. */
  readonly existingAxes: readonly ActivityTypeSlug[]
  readonly adjustment?: ActivationAdjustment
}

/**
 * O plano de ativação.
 *
 * `remedies` é a única parte que depende de recalcular o plano com outras
 * respostas, então ela fica FORA do núcleo: sem essa separação, cada saída
 * candidata geraria as próprias saídas e a conta explodiria em recursão.
 */
export function buildActivation(input: ActivationInput): ActivationPlan {
  const built = core(input)

  return {
    ...built.plan,
    remedies: built.plan.ambition.fits ? [] : remediesFor(input, built),
    ready: built.plan.ambition.fits && built.horizonError === null,
  }
}

interface Core {
  readonly plan: Omit<ActivationPlan, 'remedies' | 'ready'>
  readonly horizonError: string | null
  readonly days: number
  readonly daysPerWeek: number
  readonly fittingTarget: number
  readonly suggestedDeadline: DayKey | null
}

function core(input: ActivationInput): Core {
  const { answers, today, adjustment } = input

  const area = resolveArea(answers.area, answers.customArea, input.existingAxes)
  const horizon = resolveHorizon(answers.horizon, today)
  const budget = resolveBudget(answers.budget)

  const days = adjustment?.days ?? horizon.days
  const deadline = adjustment?.days ? addDays(today, adjustment.days - 1) : horizon.deadline
  const daysPerWeek = adjustment?.daysPerWeek ?? budget.daysPerWeek

  const title = answers.goal.trim() || `${area.label}: primeiro passo`

  const declared = readGoalQuantity(answers.goal, area.axis)
  const declaredTotal = declared ? totalOf(declared, days, daysPerWeek) : null
  const pace = paceTarget(area.axis, days, daysPerWeek)
  const target = adjustment?.target ?? declaredTotal ?? pace

  const plan = buildPlan({
    axis: area.axis,
    title,
    target,
    today,
    deadline,
    daysPerWeek,
    minutesPerDay: budget.minutesPerDay,
    axisLabel: area.label,
    // Mexer na frequência devolve a distribuição dos dias pro gerador: os
    // dias que a pessoa marcou eram cinco, e agora são outros três.
    ...(adjustment?.daysPerWeek ? {} : { weekdays: budget.weekdays }),
    motive: null,
  })

  const availableMinutesPerWeek = budget.minutesPerDay * daysPerWeek

  const ambition = checkAmbition({
    plan,
    availableMinutesPerWeek,
    minutesPerDay: budget.minutesPerDay,
    daysPerWeek,
  })

  const targetSource: TargetSource = adjustment?.target
    ? 'ajustado'
    : declaredTotal !== null
      ? 'declarado'
      : 'ritmo'

  return {
    plan: {
      areaLabel: area.label,
      axis: area.axis,
      needsAxis: area.needsAxis,
      objectiveTitle: title,
      deadline,
      assumedDeadline: horizon.assumed && adjustment?.days === undefined,
      budget: { ...budget, daysPerWeek, minutesPerWeek: availableMinutesPerWeek },
      plan,
      milestones: plan.stages,
      actions: plan.tasks,
      firstStep: plan.tasks.find((task) => task.day === today) ?? null,
      target,
      targetSource,
      ambition,
    },
    horizonError: horizon.error,
    days,
    daysPerWeek,
    fittingTarget: plan.fittingTarget,
    suggestedDeadline: plan.suggestedDeadline,
  }
}

/**
 * O número declarado virando alvo total.
 *
 * Ritmo por dia multiplica pelas sessões que o calendário comporta, não pelos
 * dias corridos: quem treina quatro vezes por semana não treina trinta vezes
 * no mês, e prometer isso no primeiro dia é começar devendo.
 */
function totalOf(quantity: GoalQuantity, days: number, daysPerWeek: number): number {
  const weeks = Math.max(1, days / 7)

  switch (quantity.period) {
    case 'total':
      return Math.max(1, quantity.value)
    case 'dia':
      return Math.max(1, Math.round(quantity.value * Math.max(1, Math.floor(weeks * daysPerWeek))))
    case 'semana':
      return Math.max(1, Math.round(quantity.value * weeks))
  }
}

/**
 * O alvo quando a pessoa não escreveu número nenhum.
 *
 * Sai do ritmo que o eixo sustenta — não do tempo que ela declarou. É essa
 * diferença que faz a comparação existir: derivar o alvo da disponibilidade
 * faria todo plano caber por construção, e o app nunca teria nada a avisar.
 */
function paceTarget(axis: ActivityTypeSlug, days: number, daysPerWeek: number): number {
  const sessions = Math.max(1, Math.floor((days / 7) * daysPerWeek))
  return Math.max(1, comfortableSessionOf(axis) * sessions)
}

/**
 * Ambição contra disponibilidade, na semana.
 *
 * A semana é a base porque é onde a frequência vive: comparar por dia
 * esconderia que quatro sessões de 45 minutos não cabem em duas horas
 * semanais. A tolerância é do arredondamento da sessão, não folga de verdade.
 */
function checkAmbition(input: {
  plan: PlanDraft
  availableMinutesPerWeek: number
  minutesPerDay: number
  daysPerWeek: number
}): AmbitionCheck {
  const required = input.plan.minutesPerSession * input.plan.sessionsPerWeek
  const available = input.availableMinutesPerWeek
  const fits = input.plan.feasibility !== 'irreal' && required <= available + input.daysPerWeek

  const dias = input.daysPerWeek === 1 ? 'dia' : 'dias'

  return {
    fits,
    requiredMinutesPerWeek: required,
    availableMinutesPerWeek: available,
    message: fits
      ? null
      : `Seu plano exige aproximadamente ${formatDuration(required)}, mas sua disponibilidade é de ${formatDuration(available)}. Vamos reorganizar?`,
    basis: `Por semana: ${input.daysPerWeek} ${dias} de sessão × ${input.minutesPerDay} min, contra ${formatDuration(input.plan.minutesPerSession)} por sessão que o objetivo pede.`,
  }
}

/**
 * As saídas honestas, e só as que funcionam.
 *
 * Cada candidata é recalculada pelo mesmo gerador antes de virar botão: uma
 * opção que promete resolver e não resolve é pior que não oferecer opção
 * nenhuma. "Revisar manualmente" está sempre lá porque a resposta certa às
 * vezes é a pessoa mudar o que respondeu.
 */
function remediesFor(input: ActivationInput, built: Core): ActivationRemedy[] {
  const remedies: ActivationRemedy[] = []
  const type = activityType(built.plan.axis)
  const base = input.adjustment ?? {}

  /** Recalcula pelo NÚCLEO: a candidata não gera candidatas próprias. */
  const attempt = (adjustment: ActivationAdjustment) =>
    core({ ...input, adjustment }).plan

  // 1. Reduzir as ações até o tamanho que o tempo comporta.
  const smaller = attempt({ ...base, target: built.fittingTarget })
  if (smaller.ambition.fits) {
    remedies.push({
      key: 'reduzir',
      label: 'Reduzir as ações',
      detail: `Cada sessão passa a pedir ${formatDuration(smaller.plan.minutesPerSession)} e o alvo vira ${smaller.target} ${type.unitLabel.many}. O objetivo continua, em tamanho menor.`,
      adjustment: { ...base, target: built.fittingTarget },
    })
  }

  // 2. Mexer na frequência. Só entra na lista se realmente resolver.
  for (const candidate of [7, 6, 5, 4, 3, 2, 1]) {
    if (candidate === built.daysPerWeek) continue
    const tried = attempt({ ...base, daysPerWeek: candidate })
    if (!tried.ambition.fits) continue

    remedies.push({
      key: 'frequencia',
      label: candidate > built.daysPerWeek ? 'Espalhar em mais dias' : 'Concentrar em menos dias',
      detail: `${candidate} ${candidate === 1 ? 'dia' : 'dias'} por semana deixa cada sessão em ${formatDuration(tried.plan.minutesPerSession)}.`,
      adjustment: { ...base, daysPerWeek: candidate },
    })
    break
  }

  // 3. Esticar o prazo até a sessão voltar pro tamanho sustentável.
  if (built.suggestedDeadline) {
    const extra = daysBetween(built.plan.deadline, built.suggestedDeadline)
    if (extra > 0) {
      const longer = attempt({ ...base, days: built.days + extra })
      if (longer.ambition.fits) {
        remedies.push({
          key: 'prazo',
          label: 'Ampliar o prazo',
          detail: `Mais ${extra} ${extra === 1 ? 'dia' : 'dias'} deixam a sessão em ${formatDuration(longer.plan.minutesPerSession)}, sem mexer no alvo.`,
          adjustment: { ...base, days: built.days + extra },
        })
      }
    }
  }

  remedies.push({
    key: 'manual',
    label: 'Revisar manualmente',
    detail: 'Volta pras perguntas e muda o prazo ou o tempo que você reservou.',
  })

  return remedies
}

/** 340 vira "5h40", 120 vira "2h", 45 vira "45 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`

  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
