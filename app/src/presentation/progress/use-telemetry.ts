import { useMemo } from 'react'
import { addDays, dayKeyToDate, type DayKey } from '@/domain/entities/day'
import { momentumHistory } from '@/domain/entities/momentum'
import {
  bestWeekday,
  consistencyMap,
  currentWeek,
  peakWindow,
  recoveryRate,
  type BestWeekday,
  type ConsistencyMap,
  type CurrentWeek,
  type PeakWindow,
  type RecoveryRate,
} from '@/domain/entities/rhythm'
import { useMomentumInput } from '@/presentation/planner/use-momentum-input'

export const PERIODS = [
  { value: '7d', label: '7D', days: 7 },
  { value: '30d', label: '30D', days: 30 },
  { value: '3m', label: '3M', days: 90 },
  { value: '1a', label: '1A', days: 365 },
] as const

export type Period = (typeof PERIODS)[number]['value']

export interface Telemetry {
  readonly week: CurrentWeek
  readonly map: ConsistencyMap
  readonly recovery: RecoveryRate
  readonly peak: PeakWindow | null
  readonly bestDay: BestWeekday | null
}

/** As leituras do ritmo do Progresso, todas sobre a mesma entrada do Momentum. */
export function useTelemetry(): Telemetry {
  const input = useMomentumInput()

  return useMemo(
    () => ({
      week: currentWeek(input),
      map: consistencyMap(input),
      recovery: recoveryRate(input),
      peak: peakWindow(input),
      bestDay: bestWeekday(input),
    }),
    [input],
  )
}

export interface MomentumCurve {
  readonly values: readonly number[]
  readonly ticks: readonly string[]
}

function tickLabel(day: DayKey, today: DayKey): string {
  if (day === today) return 'Hoje'
  return dayKeyToDate(day)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '')
}

/** A curva do score no período escolhido, com quatro marcas no eixo. */
export function useMomentumCurve(period: Period): MomentumCurve {
  const input = useMomentumInput()

  return useMemo(() => {
    const days = PERIODS.find((entry) => entry.value === period)?.days ?? 30
    const points = momentumHistory(input, days)
    const start = addDays(input.today, -(days - 1))
    const ticks = [0, 1 / 3, 2 / 3, 1].map((fraction) =>
      tickLabel(addDays(start, Math.round((days - 1) * fraction)), input.today),
    )
    return { values: points.map((point) => point.value), ticks }
  }, [input, period])
}
