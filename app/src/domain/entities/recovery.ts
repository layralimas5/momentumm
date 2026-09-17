import { activityType } from './activity-type'
import type { AdaptiveObjective } from './adaptive-day'
import type { CapacityProfile } from './checkin'
import { addDays, dayKeyOf, type DayKey } from './day'
import {
  countsAsDone,
  habitsForDay,
  habitStreak,
  habitTargetLabel,
  statusOf,
  type Habit,
  type HabitLog,
} from './habit'
import type { DayDot, MomentumScore } from './momentum'
import { impactPointsOf, taskImpact } from './momentum-impact'
import { isRunning } from './objective'
import { isPending, overdueTasks, postponedBetween, type Task } from './task'

/**
 * Modo Retomada: o que o app faz quando a pessoa perdeu o ritmo.
 *
 * A regra que manda aqui é de produto, não de algoritmo: **nada de punição**.
 * Sequência não é encerrada, dívida não é somada, e a tela não conta quantos
 * dias foram perdidos. Um app que abre com "você falhou 6 dias" é um app que a
 * pessoa desinstala no sétimo.
 *
 * ## Por que sinais COMBINADOS
 *
 * Um sinal isolado quase sempre é ruído. Três dias fracos podem ser uma
 * viagem; uma queda no momentum pode ser uma semana de férias; um objetivo
 * parado pode estar esperando outra pessoa. O que caracteriza perda de ritmo é
 * a coincidência: por isso o modo só liga com pelo menos
 * `MIN_SIGNALS_FOR_RECOVERY` sinais ao mesmo tempo, e cada um deles carrega o
 * número real que o produziu.
 *
 * ## O que ele oferece
 *
 * Até três passos PEQUENOS, escolhidos pelo maior avanço por minuto — não
 * pelos mais importantes, e muito menos pelos mais atrasados. Voltar é o
 * objetivo; o tamanho certo do primeiro passo é o menor que ainda move alguma
 * coisa de verdade.
 */

export const RECOVERY_MESSAGE =
  'Parece que você perdeu um pouco do ritmo. Não precisamos recuperar tudo hoje.'

export const RECOVERY_SIGNALS = [
  'baixa-execucao',
  'objetivos-parados',
  'adiamentos',
  'queda-momentum',
] as const
export type RecoverySignalKey = (typeof RECOVERY_SIGNALS)[number]

export const RECOVERY_SIGNAL_LABELS: Readonly<Record<RecoverySignalKey, string>> = {
  'baixa-execucao': 'Execução baixa',
  'objetivos-parados': 'Objetivo parado',
  adiamentos: 'Adiamentos seguidos',
  'queda-momentum': 'Momentumm em queda',
}

/** Sinais simultâneos pra ligar o modo. Um sozinho é ruído. */
export const MIN_SIGNALS_FOR_RECOVERY = 2

/** Dias seguidos de execução fraca que caracterizam o primeiro sinal. */
const LOW_EXECUTION_DAYS = 3

/** Abaixo disso o dia foi fraco: presença sem nada que mova o plano. */
const LOW_DAY_CREDIT = 0.5

/** Dias sem nenhuma ação concluída a partir dos quais o objetivo está parado. */
const STALLED_DAYS = 7

/** Ações atrasadas ou adiadas que caracterizam adiamento recorrente. */
const POSTPONE_THRESHOLD = 3

/** Queda no score que deixa de ser oscilação e vira sinal. */
const MOMENTUM_DROP = 8

/** Passo maior que isso não é um passo de retomada, é o dia inteiro de volta. */
const MAX_STEP_MIN = 30

/** Quantos passos o modo oferece. Mais que três vira lista, e lista é o problema. */
export const MAX_RECOVERY_STEPS = 3

export interface RecoverySignal {
  readonly key: RecoverySignalKey
  readonly label: string
  /** O dado que produziu o sinal, em números. Nunca uma frase genérica. */
  readonly detail: string
}

export interface RecoveryStep {
  readonly kind: 'acao' | 'habito'
  readonly id: string
  readonly title: string
  /** Quanto tempo esse passo pede. Zero quando o eixo não é medido em tempo. */
  readonly minutes: number
  /** O passo é a versão mínima de algo maior. */
  readonly minimal: boolean
  /** O texto da versão mínima, quando existe. */
  readonly minimalTitle: string | null
  /** Por que esse passo destrava alguma coisa de verdade. */
  readonly reason: string
  readonly objectiveTitle: string | null
  /** A ação está marcada pra outro dia e precisa vir pra hoje. */
  readonly fromAnotherDay: boolean
}

export interface RecoveryState {
  readonly today: DayKey
  readonly message: string
  /** A leitura curta do que aconteceu, sem contar dias perdidos. */
  readonly headline: string
  readonly signals: readonly RecoverySignal[]
  readonly steps: readonly RecoveryStep[]
}

export interface RecoveryInput {
  readonly today: DayKey
  /** Os últimos sete dias com o crédito real de cada um (`dailySeries`). */
  readonly series: readonly DayDot[]
  readonly tasks: readonly Task[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly momentum: MomentumScore
  readonly objectives: readonly AdaptiveObjective[]
  readonly capacity: CapacityProfile
}

/**
 * O modo, quando ele deve existir. `null` na esmagadora maioria dos dias — e é
 * isso que faz o card significar alguma coisa no dia em que ele aparece.
 */
export function detectRecovery(input: RecoveryInput): RecoveryState | null {
  /*
    Quem já se moveu hoje não precisa de convite pra voltar.

    O modo existe pra tirar do zero, e a pessoa que marcou um hábito às oito da
    manhã já saiu. Insistir seria transformar um recado de acolhimento num
    lembrete diário de que ela andou mal na semana passada.
  */
  if (movedToday(input)) return null

  const signals = detectSignals(input)
  if (signals.length < MIN_SIGNALS_FOR_RECOVERY) return null

  return {
    today: input.today,
    message: RECOVERY_MESSAGE,
    headline: headlineOf(signals),
    signals,
    steps: buildSteps(input),
  }
}

function movedToday(input: RecoveryInput): boolean {
  const today = input.series.find((dot) => dot.day === input.today)
  if (today && today.intensity > 0) return true

  return input.tasks.some((task) => task.day === input.today && task.status === 'feita')
}

// ---------------------------------------------------------------------------
// sinais
// ---------------------------------------------------------------------------

function detectSignals(input: RecoveryInput): RecoverySignal[] {
  const signals: RecoverySignal[] = []

  const lowDays = lowExecutionDays(input)
  if (lowDays >= LOW_EXECUTION_DAYS) {
    signals.push({
      key: 'baixa-execucao',
      label: RECOVERY_SIGNAL_LABELS['baixa-execucao'],
      detail: `${lowDays} dias seguidos com pouca coisa saindo do plano.`,
    })
  }

  const stalled = stalledObjectives(input)
  if (stalled.length > 0) {
    const names = stalled.slice(0, 2).join(' e ')
    signals.push({
      key: 'objetivos-parados',
      label: RECOVERY_SIGNAL_LABELS['objetivos-parados'],
      detail:
        stalled.length === 1
          ? `${names} não recebe uma ação concluída há ${STALLED_DAYS} dias.`
          : `${stalled.length} objetivos sem avanço há ${STALLED_DAYS} dias, entre eles ${names}.`,
    })
  }

  const dragging = draggingCount(input)
  if (dragging >= POSTPONE_THRESHOLD) {
    signals.push({
      key: 'adiamentos',
      label: RECOVERY_SIGNAL_LABELS.adiamentos,
      detail: `${dragging} ações em aberto vêm sendo empurradas de um dia pro outro.`,
    })
  }

  if (input.momentum.delta <= -MOMENTUM_DROP) {
    signals.push({
      key: 'queda-momentum',
      label: RECOVERY_SIGNAL_LABELS['queda-momentum'],
      detail: `O Momentumm caiu ${Math.abs(input.momentum.delta)} pontos contra a semana passada.`,
    })
  }

  return signals
}

/**
 * Dias fracos imediatamente antes de hoje.
 *
 * Hoje fica de fora de propósito: ele ainda está acontecendo, e contar um dia
 * em aberto como falha faria o modo aparecer toda manhã.
 */
function lowExecutionDays(input: RecoveryInput): number {
  const previous = input.series.filter((dot) => dot.day < input.today)

  let count = 0
  for (let index = previous.length - 1; index >= 0; index -= 1) {
    const dot = previous[index]
    if (!dot || dot.intensity >= LOW_DAY_CREDIT) break
    count += 1
  }
  return count
}

/** Objetivos que ainda cobram o dia e não recebem conclusão há uma semana. */
function stalledObjectives(input: RecoveryInput): string[] {
  const limit = addDays(input.today, -STALLED_DAYS)

  return input.objectives
    .filter((item) => {
      const objective = item.progress.objective
      if (!isRunning(objective)) return false
      if (item.plan.nextTask === null && item.plan.overdueCount === 0) return false

      const moved = input.tasks.some(
        (task) =>
          task.objectiveId === objective.id &&
          task.completedAt !== null &&
          dayKeyOf(task.completedAt) >= limit,
      )
      return !moved
    })
    .map((item) => item.progress.objective.title)
}

/**
 * Ações que vêm sendo empurradas.
 *
 * Soma o que venceu e continua aberto com o que foi adiado explicitamente nas
 * duas últimas semanas: são as duas formas do mesmo comportamento, e olhar só
 * uma delas perderia metade dos casos.
 */
function draggingCount(input: RecoveryInput): number {
  const overdue = overdueTasks(input.tasks, input.today).length
  const postponed = postponedBetween(input.tasks, addDays(input.today, -13), input.today)
  return overdue + postponed
}

function headlineOf(signals: readonly RecoverySignal[]): string {
  const keys = new Set(signals.map((signal) => signal.key))

  if (keys.has('objetivos-parados') && keys.has('baixa-execucao')) {
    return 'A semana ficou quieta e os objetivos pararam junto.'
  }
  if (keys.has('adiamentos')) return 'O que estava planejado vem sendo empurrado.'
  if (keys.has('queda-momentum')) return 'O ritmo caiu, e dá pra virar isso com pouca coisa.'
  return 'A semana ficou mais quieta que o normal.'
}

// ---------------------------------------------------------------------------
// os passos de volta
// ---------------------------------------------------------------------------

interface StepCandidate extends RecoveryStep {
  /** Avanço por minuto: é isso, e não a importância, que ordena a volta. */
  readonly ratio: number
  readonly objectiveId: string | null
}

/**
 * Até três passos, do menor esforço capaz de gerar avanço real.
 *
 * A ordem é por avanço POR MINUTO. A ação mais importante do plano costuma ser
 * a maior, e oferecer ela como porta de entrada é pedir pra pessoa recomeçar
 * pelo degrau mais alto — que é exatamente como ela parou.
 */
function buildSteps(input: RecoveryInput): RecoveryStep[] {
  const candidates = [...taskSteps(input), ...habitSteps(input)].sort((a, b) => b.ratio - a.ratio)

  const chosen: StepCandidate[] = []
  const usedObjectives = new Set<string>()

  // Uma frente por objetivo: três passos do mesmo plano dão a sensação de
  // estar de volta em um lugar só, e é justamente a variedade que mostra que o
  // dia inteiro continua acessível.
  for (const candidate of candidates) {
    if (chosen.length >= MAX_RECOVERY_STEPS) break
    if (candidate.objectiveId && usedObjectives.has(candidate.objectiveId)) continue
    if (candidate.objectiveId) usedObjectives.add(candidate.objectiveId)
    chosen.push(candidate)
  }

  for (const candidate of candidates) {
    if (chosen.length >= MAX_RECOVERY_STEPS) break
    if (chosen.some((item) => item.id === candidate.id)) continue
    chosen.push(candidate)
  }

  return chosen.map(({ ratio: _ratio, objectiveId: _objectiveId, ...step }) => step)
}

function taskSteps(input: RecoveryInput): StepCandidate[] {
  const byObjective = new Map(input.objectives.map((item) => [item.progress.objective.id, item]))
  const stalled = new Set(stalledObjectives(input))

  /*
    O que entra: o que está marcado pra hoje, o que venceu e a próxima ação de
    cada plano. Ação vencida aparece aqui porque escolher UMA de volta é o
    contrário de acumular — o que o produto recusa é o app empilhar todas elas
    no dia sozinho.
  */
  const pool = new Map<string, Task>()
  for (const task of input.tasks) {
    if (!isPending(task)) continue
    if (task.day <= input.today) pool.set(task.id, task)
  }
  for (const item of input.objectives) {
    const next = item.plan.nextTask
    if (next && isPending(next)) pool.set(next.id, next)
  }

  return [...pool.values()].flatMap((task) => {
    const linked = task.objectiveId ? (byObjective.get(task.objectiveId) ?? null) : null
    if (linked && !isRunning(linked.progress.objective)) return []

    const minimal = task.minimalVersion !== null
    const minutes = minimal ? Math.max(5, Math.round(task.estimatedMin / 3)) : task.estimatedMin

    // Passo grande demais não é passo de volta. Ele continua no dia, só não é
    // oferecido como a porta de entrada.
    if (minutes > MAX_STEP_MIN) return []

    let advance = impactPointsOf(taskImpact(task))
    const isBottleneck =
      task.stageId !== null && linked?.plan.bottleneck?.stage.id === task.stageId
    if (isBottleneck) advance += 2
    if (linked && stalled.has(linked.progress.objective.title)) advance += 2

    const objectiveTitle = linked?.progress.objective.title ?? null

    return [
      {
        kind: 'acao' as const,
        id: task.id,
        title: minimal ? (task.minimalVersion ?? task.title) : task.title,
        minutes,
        minimal,
        minimalTitle: task.minimalVersion,
        reason: reasonOfTask({ task, objectiveTitle, isBottleneck, minimal, minutes, stalled }),
        objectiveTitle,
        fromAnotherDay: task.day !== input.today,
        ratio: advance / Math.max(5, minutes),
        objectiveId: task.objectiveId,
      },
    ]
  })
}

function reasonOfTask(input: {
  task: Task
  objectiveTitle: string | null
  isBottleneck: boolean
  minimal: boolean
  minutes: number
  stalled: ReadonlySet<string>
}): string {
  const { objectiveTitle, isBottleneck, minimal, minutes, stalled } = input
  const size = minimal ? `Versão mínima, ${minutes} min.` : `${minutes} min.`

  if (isBottleneck && objectiveTitle) {
    return `${size} Destrava a etapa que está segurando ${objectiveTitle}.`
  }
  if (objectiveTitle && stalled.has(objectiveTitle)) {
    return `${size} Tira ${objectiveTitle} da inércia: é o objetivo que está parado há mais tempo.`
  }
  if (objectiveTitle) return `${size} Empurra ${objectiveTitle} sem tomar o dia.`
  return `${size} Pequena o suficiente pra sair hoje.`
}

function habitSteps(input: RecoveryInput): StepCandidate[] {
  return habitsForDay(input.habits, input.habitLogs, input.today)
    .filter((habit) => !countsAsDone(statusOf(input.habitLogs, habit.id, input.today)))
    .map((habit) => {
      const inMinutes = activityType(habit.axis).unit === 'minutos'
      const minutes = inMinutes ? habit.minimalTarget : 0
      const streak = habitStreak(habit, input.habitLogs, input.today)
      const label = habitTargetLabel(habit, habit.minimalTarget)

      let advance = habit.objectiveId !== null ? 2 : 1
      if (streak > 0) advance += 1

      return {
        kind: 'habito' as const,
        id: habit.id,
        title: habit.name,
        minutes,
        minimal: habit.minimalTarget < habit.target,
        minimalTitle: label,
        reason:
          streak > 0
            ? `${label} já reativa a sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}.`
            : `${label} é o suficiente pra o hábito contar hoje.`,
        objectiveTitle: null,
        fromAnotherDay: false,
        ratio: advance / Math.max(5, minutes),
        objectiveId: habit.objectiveId,
      }
    })
}

/**
 * O tamanho do dia depois de escolher o passo.
 *
 * O passo mais a folga que a capacidade de hoje comporta — nunca o dia cheio.
 * Reorganizar a volta pra caber tudo de novo seria devolver a pessoa
 * exatamente ao dia que ela não conseguiu cumprir.
 */
export function recoveryBudgetOf(step: RecoveryStep, capacity: CapacityProfile): number {
  return Math.max(step.minutes, 0) + capacity.suggestedFocusMin
}
