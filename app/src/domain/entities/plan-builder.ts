import { activityType, formatUnit, type ActivityTypeSlug } from './activity-type'
import { addDays, daysBetween, type DayKey } from './day'
import type { NewGoalInput } from './goal'
import type { HabitIcon, NewHabitInput } from './habit'
import type { NewObjectiveInput } from './objective'
import type { NewTaskInput } from './task'

/**
 * O gerador de plano.
 *
 * É o passo em que o Momentumm para de perguntar e começa a responder: recebe
 * o objetivo, o prazo e quantos dias por semana cabem na vida da pessoa, e
 * devolve o plano inteiro pronto pra virar hábito e ação.
 *
 * Três regras mandam aqui:
 *
 * 1. **Nada de aleatório.** A conta é aritmética simples sobre o alvo, o prazo
 *    e a disponibilidade. O mesmo pedido gera sempre o mesmo plano, e a pessoa
 *    consegue conferir a matemática na tela.
 * 2. **O plano diz quando não cabe.** Se a sessão necessária passa do que um
 *    ser humano sustenta, o plano avisa e sugere esticar o prazo em vez de
 *    entregar um cronograma que só funciona no papel.
 * 3. **Sai daqui com uma ação pra hoje.** Plano que começa amanhã não começa.
 */

export type PlannedObjective = Omit<NewObjectiveInput, 'userId'>
export type PlannedGoal = Omit<NewGoalInput, 'userId'>
export type PlannedHabit = Omit<NewHabitInput, 'userId'>
export type PlannedTask = Omit<NewTaskInput, 'userId'>

export const FEASIBILITIES = ['confortavel', 'exigente', 'irreal'] as const
export type Feasibility = (typeof FEASIBILITIES)[number]

export interface PlanDraft {
  readonly objective: PlannedObjective
  readonly goal: PlannedGoal
  readonly habits: readonly PlannedHabit[]
  /** A primeira sempre cai hoje e sempre nasce como prioridade principal. */
  readonly tasks: readonly PlannedTask[]
  readonly feasibility: Feasibility
  /** Quanto o plano pede por sessão, na unidade do eixo. */
  readonly perSession: number
  readonly sessionsPerWeek: number
  readonly totalSessions: number
  /** A explicação da conta, em uma frase. */
  readonly rationale: string
  /** Preenchido só quando o plano não cabe: o que fazer a respeito. */
  readonly warning: string | null
  /** Prazo que tornaria o plano sustentável. Null quando já está. */
  readonly suggestedDeadline: DayKey | null
}

export interface PlanInput {
  readonly axis: ActivityTypeSlug
  readonly title: string
  readonly target: number
  readonly today: DayKey
  readonly deadline: DayKey
  /** Dias por semana que a pessoa se compromete a aparecer. */
  readonly daysPerWeek: number
  readonly motive?: string | null
}

/** Sessão que ainda é confortável, e o teto do que uma pessoa sustenta por meses. */
const SESSION_LIMITS: Readonly<Record<ActivityTypeSlug, { comfortable: number; ceiling: number }>> =
  {
    leitura: { comfortable: 25, ceiling: 60 },
    estudo: { comfortable: 45, ceiling: 120 },
    treino: { comfortable: 45, ceiling: 90 },
    meditacao: { comfortable: 15, ceiling: 40 },
  }

const ICON_BY_AXIS: Readonly<Record<ActivityTypeSlug, HabitIcon>> = {
  leitura: 'livro',
  estudo: 'cerebro',
  treino: 'halter',
  meditacao: 'lotus',
}

interface AxisTemplate {
  readonly habit: string
  readonly firstStep: string
  readonly firstStepMinimal: string
  readonly preparation: string
  readonly preparationMinimal: string
  readonly checkpoint: string
}

const TEMPLATES: Readonly<Record<ActivityTypeSlug, AxisTemplate>> = {
  leitura: {
    habit: 'Ler todo dia',
    firstStep: 'Abrir o livro e ler a primeira sessão',
    firstStepMinimal: 'Ler 3 páginas',
    preparation: 'Deixar o livro onde você vai sentar',
    preparationMinimal: 'Escolher o próximo livro',
    checkpoint: 'Conferir o ritmo de leitura e ajustar o plano',
  },
  estudo: {
    habit: 'Estudar todo dia',
    firstStep: 'Fazer a primeira sessão de estudo',
    firstStepMinimal: 'Reler as anotações por 5 minutos',
    preparation: 'Montar a lista do que precisa ser estudado',
    preparationMinimal: 'Anotar os três primeiros tópicos',
    checkpoint: 'Revisar o que já foi estudado e recalibrar o plano',
  },
  treino: {
    habit: 'Treinar',
    firstStep: 'Fazer o primeiro treino',
    firstStepMinimal: 'Fazer 10 minutos de movimento',
    preparation: 'Separar a roupa e definir o horário do treino',
    preparationMinimal: 'Separar a roupa de treino',
    checkpoint: 'Avaliar a evolução do treino e ajustar a carga',
  },
  meditacao: {
    habit: 'Sentar pra respirar',
    firstStep: 'Fazer a primeira sessão guiada',
    firstStepMinimal: 'Respirar por 3 minutos',
    preparation: 'Escolher o lugar e o horário fixo da prática',
    preparationMinimal: 'Escolher o horário da prática',
    checkpoint: 'Rever como a prática está encaixando na rotina',
  },
}

/** Distribuição dos dias na semana. Espalhar evita três dias colados e quatro vazios. */
const WEEKDAYS_BY_FREQUENCY: Readonly<Record<number, readonly number[]>> = {
  1: [3],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  // Vazio significa todos os dias — é como o hábito já representa a rotina diária.
  7: [],
}

export const MIN_DAYS_PER_WEEK = 1
export const MAX_DAYS_PER_WEEK = 7

export function buildPlan(input: PlanInput): PlanDraft {
  const type = activityType(input.axis)
  const template = TEMPLATES[input.axis]
  const limits = SESSION_LIMITS[input.axis]

  const daysPerWeek = clamp(Math.round(input.daysPerWeek), MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK)
  const totalDays = Math.max(1, daysBetween(input.today, input.deadline) + 1)
  const weeks = totalDays / 7

  // Arredonda pra baixo: prometer sessão que não existe no calendário é a
  // maneira mais rápida de gerar um plano que já nasce atrasado.
  const totalSessions = Math.max(1, Math.floor(weeks * daysPerWeek))
  const perSession = Math.max(1, Math.ceil(input.target / totalSessions))
  const weeklyTarget = Math.max(1, Math.ceil(input.target / Math.max(1, weeks)))

  const feasibility: Feasibility =
    perSession > limits.ceiling
      ? 'irreal'
      : perSession > limits.comfortable
        ? 'exigente'
        : 'confortavel'

  const suggestedDeadline =
    feasibility === 'irreal' ? sustainableDeadline(input, daysPerWeek, limits.comfortable) : null

  const habit: PlannedHabit = {
    name: template.habit,
    icon: ICON_BY_AXIS[input.axis],
    axis: input.axis,
    dayPart: 'qualquer',
    weekdays: WEEKDAYS_BY_FREQUENCY[daysPerWeek] ?? [],
    target: perSession,
    // Um terço mantém a sequência viva num dia ruim sem virar teatro.
    minimalTarget: Math.max(1, Math.round(perSession / 3)),
  }

  const checkpointDay = addDays(input.today, Math.max(3, Math.floor(totalDays / 2)))

  const tasks: readonly PlannedTask[] = [
    {
      title: template.firstStep,
      axis: input.axis,
      estimatedMin: estimatedMinutes(input.axis, perSession),
      effort: feasibility === 'confortavel' ? 'medio' : 'pesado',
      minimalVersion: template.firstStepMinimal,
      day: input.today,
      isMainPriority: true,
    },
    {
      title: template.preparation,
      axis: input.axis,
      estimatedMin: 10,
      effort: 'leve',
      minimalVersion: template.preparationMinimal,
      day: input.today,
      isMainPriority: false,
    },
    {
      title: template.checkpoint,
      axis: input.axis,
      estimatedMin: 15,
      effort: 'leve',
      minimalVersion: 'Olhar o gráfico da semana e anotar uma conclusão',
      day: checkpointDay,
      isMainPriority: false,
    },
  ]

  return {
    objective: {
      title: input.title.trim(),
      axis: input.axis,
      target: Math.round(input.target),
      startedOn: input.today,
      deadline: input.deadline,
      motive: input.motive ?? null,
    },
    goal: { type: input.axis, target: weeklyTarget, period: 'semana' },
    habits: [habit],
    tasks,
    feasibility,
    perSession,
    sessionsPerWeek: daysPerWeek,
    totalSessions,
    rationale: `${formatUnit(type, Math.round(input.target))} em ${totalDays} dias, em ${daysPerWeek} ${daysPerWeek === 1 ? 'dia' : 'dias'} por semana, dá ${formatUnit(type, perSession)} por sessão.`,
    warning: warningFor(feasibility, input, perSession, suggestedDeadline),
    suggestedDeadline,
  }
}

function warningFor(
  feasibility: Feasibility,
  input: PlanInput,
  perSession: number,
  suggestedDeadline: DayKey | null,
): string | null {
  const type = activityType(input.axis)

  if (feasibility === 'confortavel') return null

  if (feasibility === 'exigente') {
    return `${formatUnit(type, perSession)} por sessão é puxado, mas cabe. Se apertar, a versão mínima do hábito segura a sequência.`
  }

  const extraDays = suggestedDeadline ? daysBetween(input.deadline, suggestedDeadline) : 0
  return `Esse prazo exige ${formatUnit(type, perSession)} por sessão, acima do que se sustenta por semanas seguidas. Aumentar o prazo em ${extraDays} ${extraDays === 1 ? 'dia' : 'dias'} ou adicionar dias na semana resolve.`
}

/** O prazo em que a sessão volta pro tamanho confortável do eixo. */
function sustainableDeadline(
  input: PlanInput,
  daysPerWeek: number,
  comfortable: number,
): DayKey {
  const sessionsNeeded = Math.ceil(input.target / comfortable)
  const daysNeeded = Math.ceil((sessionsNeeded / daysPerWeek) * 7)
  return addDays(input.today, daysNeeded - 1)
}

/**
 * Tempo estimado da ação. Eixo medido em minutos já é o próprio tempo; leitura
 * usa um ritmo médio de página, que erra pouco e evita pedir mais um número
 * no onboarding.
 */
const MINUTES_PER_PAGE = 1.5

function estimatedMinutes(axis: ActivityTypeSlug, perSession: number): number {
  const raw =
    activityType(axis).unit === 'minutos' ? perSession : Math.round(perSession * MINUTES_PER_PAGE)
  return clamp(raw, 5, 8 * 60)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Alvo sugerido pro objetivo quando a pessoa ainda não tem número na cabeça.
 * Parte do ritmo confortável do eixo, num compromisso de 5 dias por semana.
 */
export function suggestedTarget(axis: ActivityTypeSlug, days: number): number {
  const { comfortable } = SESSION_LIMITS[axis]
  const sessions = Math.max(1, Math.round((days / 7) * 5))
  return comfortable * sessions
}
