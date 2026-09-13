import type { DayKey } from '@/domain/entities/day'

/**
 * O período que todas as telas de métrica compartilham.
 *
 * Datas como `YYYY-MM-DD`, inclusivas nas duas pontas — é o que o SQL recebe
 * e o que a URL carrega. "Últimos 7 dias" termina hoje e começa seis dias
 * atrás, e a comparação é sempre com o bloco imediatamente anterior do mesmo
 * tamanho.
 */
export interface Period {
  readonly from: DayKey
  readonly to: DayKey
}

export const PERIOD_PRESETS = ['7d', '30d', '90d', 'custom'] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]

export const PERIOD_LABELS: Readonly<Record<PeriodPreset, string>> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  custom: 'Personalizado',
}

const PRESET_DAYS: Readonly<Record<Exclude<PeriodPreset, 'custom'>, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/** O máximo que uma consulta aceita. O SQL recusa acima disso também. */
export const MAX_PERIOD_DAYS = 366

export function periodFor(preset: Exclude<PeriodPreset, 'custom'>, today: DayKey): Period {
  return { from: addDays(today, -(PRESET_DAYS[preset] - 1)), to: today }
}

export function periodLengthDays(period: Period): number {
  return Math.round((parse(period.to) - parse(period.from)) / 86_400_000) + 1
}

export function previousPeriod(period: Period): Period {
  const length = periodLengthDays(period)
  return { from: addDays(period.from, -length), to: addDays(period.from, -1) }
}

export function isValidPeriod(period: Period): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.from) || !/^\d{4}-\d{2}-\d{2}$/.test(period.to)) return false
  const length = periodLengthDays(period)
  return length >= 1 && length <= MAX_PERIOD_DAYS
}

/** O preset que descreve o período, quando algum descreve. */
export function presetOf(period: Period, today: DayKey): PeriodPreset {
  for (const preset of ['7d', '30d', '90d'] as const) {
    const candidate = periodFor(preset, today)
    if (candidate.from === period.from && candidate.to === period.to) return preset
  }
  return 'custom'
}

/**
 * Variação percentual contra o período anterior.
 *
 * Nulo quando não dá pra comparar: sem base anterior (zero) ou sem dado.
 * Mostrar "+∞%" ou "+100%" quando o anterior era zero é o número que engana
 * mais em painel novo — todo primeiro mês pareceria explosivo.
 */
export function deltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return 'sem base'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function parse(day: DayKey): number {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1)
}

export function addDays(day: DayKey, amount: number): DayKey {
  const time = parse(day) + amount * 86_400_000
  return new Date(time).toISOString().slice(0, 10) as DayKey
}
