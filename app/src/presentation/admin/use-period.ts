import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  isValidPeriod,
  periodFor,
  presetOf,
  type Period,
  type PeriodPreset,
} from '@/domain/admin/period'
import { dayKeyOf } from '@/domain/entities/day'

/**
 * O período vive na URL (`?de=…&ate=…`): recarregar mantém, e o link que
 * uma pessoa manda pra outra abre a mesma janela. Sem parâmetro, 30 dias.
 */
export function usePeriod(): {
  readonly period: Period
  readonly preset: PeriodPreset
  setPreset(preset: Exclude<PeriodPreset, 'custom'>): void
  setCustom(period: Period): void
} {
  const [params, setParams] = useSearchParams()
  const today = dayKeyOf(new Date())

  const period = useMemo<Period>(() => {
    const from = params.get('de')
    const to = params.get('ate')
    if (from && to) {
      const candidate = { from, to } as Period
      if (isValidPeriod(candidate)) return candidate
    }
    return periodFor('30d', today)
  }, [params, today])

  const setCustom = useCallback(
    (next: Period) => {
      if (!isValidPeriod(next)) return
      setParams((current) => {
        const copy = new URLSearchParams(current)
        copy.set('de', next.from)
        copy.set('ate', next.to)
        return copy
      })
    },
    [setParams],
  )

  const setPreset = useCallback(
    (preset: Exclude<PeriodPreset, 'custom'>) => setCustom(periodFor(preset, today)),
    [setCustom, today],
  )

  return { period, preset: presetOf(period, today), setPreset, setCustom }
}
