import type { DayKey } from './day'
import {
  countsAsDone,
  isHabitRunning,
  isScheduledOn,
  statusOf,
  type Habit,
  type HabitLog,
} from './habit'
import {
  calculateMomentum,
  DEFAULT_MOMENTUM_WEIGHTS,
  MOMENTUM_PART_LABELS,
  type MomentumInput,
  type MomentumPartKey,
  type MomentumScore,
  type MomentumWeights,
} from './momentum'
import { impactPointsOf, taskImpact } from './momentum-impact'
import { isBlocked, isPending, type Task } from './task'

/**
 * A próxima ação com maior potencial de melhorar o ritmo.
 *
 * Não é uma heurística sobre o score: é o próprio score, recalculado com cada
 * item em aberto marcado como feito hoje. O que ganha é o que mais sobe o
 * número — pela MESMA função que o número usa. Uma regra à parte ("prioridade
 * primeiro") divergiria do cálculo no primeiro dia em que a retomada valesse
 * mais que a prioridade, e a pessoa faria o que o card manda e veria o número
 * não mexer.
 *
 * Os candidatos são as ações em aberto de hoje ou vencidas (a vencida entra
 * como se fosse trazida pra hoje) e os hábitos programados pra hoje que ainda
 * não saíram. Ação travada por dependência fica de fora: sugerir o que não dá
 * pra fazer é o mesmo que não sugerir.
 */
export interface MomentumNextAction {
  readonly kind: 'acao' | 'habito'
  readonly id: string
  readonly title: string
  readonly task: Task | null
  readonly habit: Habit | null
  /** Pontos que o número exibido ganha hoje se isso sair, já com o limite diário. */
  readonly gain: number
  /** Pontos que o valor bruto ganha, sem o limite diário. */
  readonly rawGain: number
  /** O fator que mais sobe com isso. */
  readonly factor: MomentumPartKey
  /** Por que essa e não outra, em uma frase. */
  readonly reason: string
}

/** Abaixo disso a sugestão não vale a linha na tela. */
const MIN_RAW_GAIN = 0.5

export function bestNextAction(
  input: MomentumInput,
  weights: MomentumWeights = DEFAULT_MOMENTUM_WEIGHTS,
): MomentumNextAction | null {
  const baseline = calculateMomentum(input, weights)
  const candidates = [...taskCandidates(input), ...habitCandidates(input)]
  if (candidates.length === 0) return null

  let best: MomentumNextAction | null = null
  let bestRaw = -Infinity

  for (const candidate of candidates) {
    const simulated = calculateMomentum(candidate.simulate(input), weights)
    const rawGain = simulated.rawValue - baseline.rawValue
    const gain = simulated.value - baseline.value
    if (rawGain < MIN_RAW_GAIN) continue

    // Empate no ganho: fica o item de maior impacto, que é o que o produto
    // quer que saia primeiro quando o número não distingue.
    const better =
      rawGain > bestRaw + 1e-9 || (Math.abs(rawGain - bestRaw) <= 1e-9 && candidate.impact > (best ? impactOf(best) : 0))
    if (!better) continue

    const factor = strongestFactor(baseline, simulated, weights)
    bestRaw = rawGain
    best = {
      kind: candidate.kind,
      id: candidate.id,
      title: candidate.title,
      task: candidate.task,
      habit: candidate.habit,
      gain: Math.max(0, Math.round(gain)),
      rawGain: Math.round(rawGain),
      factor,
      reason: reasonFor(candidate, factor, Math.round(rawGain), Math.round(gain)),
    }
  }

  return best
}

interface Candidate {
  readonly kind: 'acao' | 'habito'
  readonly id: string
  readonly title: string
  readonly task: Task | null
  readonly habit: Habit | null
  readonly impact: number
  readonly overdue: boolean
  simulate(input: MomentumInput): MomentumInput
}

function impactOf(action: MomentumNextAction): number {
  if (action.task) return impactPointsOf(taskImpact(action.task))
  return 1
}

function taskCandidates(input: MomentumInput): Candidate[] {
  const { today, tasks } = input
  return tasks
    .filter((task) => isPending(task) && task.day <= today && !isBlocked(task, tasks))
    .map((task) => ({
      kind: 'acao' as const,
      id: task.id,
      title: task.title,
      task,
      habit: null,
      impact: impactPointsOf(taskImpact(task)),
      overdue: task.day < today,
      simulate: (current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === task.id
            ? { ...item, day: today, status: 'feita' as const, completedAt: new Date() }
            : item,
        ),
      }),
    }))
}

function habitCandidates(input: MomentumInput): Candidate[] {
  const { today, habits, habitLogs } = input
  return habits
    .filter(
      (habit) =>
        isHabitRunning(habit) &&
        isScheduledOn(habit, today) &&
        !countsAsDone(statusOf(habitLogs, habit.id, today)),
    )
    .map((habit) => ({
      kind: 'habito' as const,
      id: habit.id,
      title: habit.name,
      task: null,
      habit,
      impact: 1,
      overdue: false,
      simulate: (current) => ({
        ...current,
        habitLogs: [...current.habitLogs, simulatedLog(habit, today)],
      }),
    }))
}

function simulatedLog(habit: Habit, day: DayKey): HabitLog {
  return {
    id: `simulated-${habit.id}-${day}`,
    userId: habit.userId,
    habitId: habit.id,
    day,
    status: 'feito',
    createdAt: new Date(),
  }
}

/** O fator que mais ganhou pontos do score entre o antes e o depois. */
function strongestFactor(
  before: MomentumScore,
  after: MomentumScore,
  weights: MomentumWeights,
): MomentumPartKey {
  const keys = Object.keys(weights) as MomentumPartKey[]
  let best: MomentumPartKey = 'consistency'
  let bestGain = -Infinity
  for (const key of keys) {
    const gain = (after.parts[key] - before.parts[key]) * weights[key]
    if (gain > bestGain) {
      bestGain = gain
      best = key
    }
  }
  return best
}

function reasonFor(
  candidate: Candidate,
  factor: MomentumPartKey,
  rawGain: number,
  gain: number,
): string {
  const label = MOMENTUM_PART_LABELS[factor].toLowerCase()
  const points = gain > 0 ? `+${gain}` : `+${rawGain} no bruto`
  const where =
    factor === 'recovery'
      ? 'Fecha a pausa e conta como retomada.'
      : factor === 'priorities'
        ? candidate.overdue
          ? 'Tira uma ação vencida da conta e sobe a execução.'
          : 'É o item de maior impacto ainda em aberto.'
        : candidate.kind === 'habito'
          ? 'Garante que hoje conte como dia com movimento.'
          : 'Fecha o dia de hoje com movimento de verdade.'

  return `${where} ${points} no score hoje, puxado por ${label}.`
}
