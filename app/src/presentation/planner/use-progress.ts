import { useMemo } from 'react'
import { totalMinutes } from '@/domain/entities/activity'
import { addDays, dayRange, startOfMonth, type DayKey } from '@/domain/entities/day'
import { countsAsDone, scheduledCountBetween } from '@/domain/entities/habit'
import {
  calculateMomentum,
  dailySeries,
  momentumFactors,
  weakestFactor,
  type DayDot,
  type MomentumFactor,
  type MomentumInput,
  type MomentumScore,
} from '@/domain/entities/momentum'
import { summarizeWeek, type WeeklySummary } from '@/domain/entities/week'
import { usePlanner } from './use-planner'
import { useObjectives, type ObjectiveView } from './use-objectives'

/** Uma taxa e a mesma taxa no período anterior. É a comparação que dá sentido. */
export interface Rate {
  readonly done: number
  readonly total: number
  readonly ratio: number
  readonly previousRatio: number
}

export interface PeriodTotals {
  readonly label: string
  readonly days: number
  readonly activeDays: number
  readonly minutes: number
  readonly habits: Rate
  readonly tasks: Rate
}

export interface ProgressView {
  readonly momentum: MomentumScore
  readonly factors: readonly MomentumFactor[]
  readonly weakest: MomentumFactor | null
  readonly series: readonly DayDot[]
  readonly week: WeeklySummary
  readonly month: PeriodTotals
  readonly last7: PeriodTotals
  readonly objectives: readonly ObjectiveView[]
  readonly activeObjectives: number
  readonly completedObjectives: number
  readonly stalled: readonly ObjectiveView[]
  /** O que está indo bem, em frases curtas. */
  readonly gains: readonly string[]
  /** O que precisa de atenção. */
  readonly risks: readonly string[]
}

/**
 * A leitura do progresso.
 *
 * Tudo aqui existe pra responder quatro perguntas e nada além delas: onde estou
 * evoluindo, onde estou perdendo constância, o que está travando e qual é o
 * próximo ajuste. Métrica que não responde nenhuma das quatro não entra na
 * tela, por mais fácil que seja de calcular.
 */
export function useProgress(): ProgressView {
  const planner = usePlanner()
  const objectives = useObjectives()

  const { activities, habits, habitLogs, tasks, today } = planner

  const input = useMemo<MomentumInput>(
    () => ({ activities, habits, habitLogs, tasks, today }),
    [activities, habits, habitLogs, tasks, today],
  )

  const momentum = useMemo(() => calculateMomentum(input), [input])
  const week = useMemo(() => summarizeWeek(input), [input])
  const series = useMemo(() => dailySeries(input), [input])

  const last7 = useMemo(
    () => totalsFor(input, addDays(today, -6), today, 'Últimos 7 dias'),
    [input, today],
  )

  const month = useMemo(
    () => totalsFor(input, startOfMonth(today), today, 'Este mês'),
    [input, today],
  )

  return useMemo(() => {
    const factors = momentumFactors(momentum)
    const stalled = objectives.filter((view) => view.stalled)

    const gains: string[] = []
    const risks: string[] = []

    if (last7.ratioUp('habits')) {
      gains.push(
        `Teus hábitos subiram de ${pct(last7.habits.previousRatio)} pra ${pct(last7.habits.ratio)}.`,
      )
    } else if (last7.habits.total > 0 && last7.habits.ratio < 0.5) {
      risks.push(
        `Só ${pct(last7.habits.ratio)} dos hábitos programados saíram na semana. Provavelmente é tamanho, não vontade.`,
      )
    }

    if (last7.ratioUp('tasks')) {
      gains.push(
        `A execução das ações foi de ${pct(last7.tasks.previousRatio)} pra ${pct(last7.tasks.ratio)}.`,
      )
    } else if (last7.tasks.total > 0 && last7.tasks.ratio < 0.5) {
      risks.push(
        `Você concluiu ${pct(last7.tasks.ratio)} das ações planejadas. Vale planejar menos por dia em vez de tentar render mais.`,
      )
    }

    if (last7.activeDays >= 6) {
      gains.push(`Você se moveu em ${last7.activeDays} dos últimos 7 dias.`)
    } else if (last7.activeDays <= 2) {
      risks.push(
        `Só ${last7.activeDays} ${last7.activeDays === 1 ? 'dia teve' : 'dias tiveram'} movimento na última semana.`,
      )
    }

    for (const view of stalled) {
      risks.push(`"${view.progress.objective.title}" está sem nenhum registro há mais de uma semana.`)
    }

    for (const view of objectives) {
      /*
        O gargalo antes do atraso genérico. "Está atrasado" a pessoa já sabe; o
        que ela não sabe é QUAL pedaço está segurando — e é essa a informação
        que muda o que ela faz amanhã de manhã.
      */
      if (view.plan.bottleneck && view.plan.bottleneck.overdueTasks.length > 0) {
        const stage = view.plan.bottleneck
        risks.push(
          `A etapa "${stage.stage.title}" segura ${view.progress.objective.title}: ${stage.overdueTasks.length} ${stage.overdueTasks.length === 1 ? 'ação atrasada' : 'ações atrasadas'} em ${stage.stage.weight}% do objetivo.`,
        )
      }

      if (view.forecast.kind === 'estimado' && view.forecast.daysLate > 0) {
        risks.push(
          `No ritmo atual, "${view.progress.objective.title}" fecha ${view.forecast.daysLate} ${view.forecast.daysLate === 1 ? 'dia' : 'dias'} depois do prazo.`,
        )
      }

      if (view.forecast.kind === 'estimado' && view.forecast.daysLate < 0) {
        gains.push(
          `"${view.progress.objective.title}" está adiantado: no ritmo atual fecha ${Math.abs(view.forecast.daysLate)} ${Math.abs(view.forecast.daysLate) === 1 ? 'dia' : 'dias'} antes do prazo.`,
        )
      }

      if (view.progress.status === 'atrasado' && view.progress.state === 'em-andamento') {
        risks.push(
          `"${view.progress.objective.title}" está atrasado: ${Math.ceil(view.progress.dailyPace)} por dia pra fechar no prazo.`,
        )
      }
      if (view.progress.status === 'no-prazo' && view.progress.ratio > 0.5) {
        gains.push(
          `"${view.progress.objective.title}" passou da metade e está no prazo.`,
        )
      }
    }

    return {
      momentum,
      factors,
      weakest: weakestFactor(momentum),
      series,
      week,
      month,
      last7,
      objectives,
      activeObjectives: objectives.filter((view) => view.progress.state === 'em-andamento').length,
      completedObjectives: objectives.filter((view) => view.progress.state === 'concluido').length,
      stalled,
      gains: gains.slice(0, 4),
      risks: risks.slice(0, 4),
    }
  }, [momentum, series, week, month, last7, objectives])
}

interface TotalsWithHelpers extends PeriodTotals {
  ratioUp(key: 'habits' | 'tasks'): boolean
}

/** Diferença mínima pra dizer que alguma coisa mudou de verdade. */
const MEANINGFUL_DELTA = 0.1

function totalsFor(
  input: MomentumInput,
  start: DayKey,
  end: DayKey,
  label: string,
): TotalsWithHelpers {
  const days = dayRange(start, end).length
  const previousEnd = addDays(start, -1)
  const previousStart = addDays(previousEnd, -(days - 1))

  const totals = {
    label,
    days,
    activeDays: activeDaysBetween(input, start, end),
    minutes: totalMinutes(
      input.activities.filter((item) => item.day >= start && item.day <= end),
    ),
    habits: rateOf(habitRate(input, start, end), habitRate(input, previousStart, previousEnd)),
    tasks: rateOf(taskRate(input, start, end), taskRate(input, previousStart, previousEnd)),
  }

  return {
    ...totals,
    ratioUp(key) {
      const rate = totals[key]
      return rate.total > 0 && rate.ratio - rate.previousRatio >= MEANINGFUL_DELTA
    },
  }
}

interface Counted {
  readonly done: number
  readonly total: number
}

function rateOf(current: Counted, previous: Counted): Rate {
  return {
    done: current.done,
    total: current.total,
    ratio: current.total === 0 ? 0 : current.done / current.total,
    previousRatio: previous.total === 0 ? 0 : previous.done / previous.total,
  }
}

function habitRate(input: MomentumInput, start: DayKey, end: DayKey): Counted {
  const total = input.habits.reduce(
    (sum, habit) => sum + scheduledCountBetween(habit, start, end),
    0,
  )
  const done = input.habitLogs.filter(
    (log) => log.day >= start && log.day <= end && countsAsDone(log.status),
  ).length

  return { done, total }
}

function taskRate(input: MomentumInput, start: DayKey, end: DayKey): Counted {
  // Cancelada sai da conta: largar conscientemente não é o mesmo que falhar.
  const counted = input.tasks.filter(
    (task) => task.day >= start && task.day <= end && task.status !== 'cancelada',
  )
  return { done: counted.filter((task) => task.status === 'feita').length, total: counted.length }
}

function activeDaysBetween(input: MomentumInput, start: DayKey, end: DayKey): number {
  const days = new Set<DayKey>()
  for (const activity of input.activities) {
    if (activity.day >= start && activity.day <= end) days.add(activity.day)
  }
  for (const log of input.habitLogs) {
    if (log.day >= start && log.day <= end && countsAsDone(log.status)) days.add(log.day)
  }
  return days.size
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}
