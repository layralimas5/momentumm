import { describe, expect, it } from 'vitest'
import type { DayKey } from '@/domain/entities/day'
import {
  deltaPercent,
  formatDelta,
  isValidPeriod,
  periodFor,
  periodLengthDays,
  presetOf,
  previousPeriod,
  type Period,
} from './period'

const today = '2026-09-11' as DayKey

describe('período das métricas', () => {
  it('os presets terminam hoje e têm o tamanho certo', () => {
    expect(periodFor('7d', today)).toEqual({ from: '2026-09-05', to: '2026-09-11' })
    expect(periodFor('30d', today)).toEqual({ from: '2026-08-13', to: '2026-09-11' })
    expect(periodLengthDays(periodFor('90d', today))).toBe(90)
  })

  it('o período anterior tem o mesmo tamanho e termina na véspera', () => {
    const current = periodFor('7d', today)
    expect(previousPeriod(current)).toEqual({ from: '2026-08-29', to: '2026-09-04' })
  })

  it('reconhece o preset de um período e chama o resto de personalizado', () => {
    expect(presetOf(periodFor('30d', today), today)).toBe('30d')
    expect(presetOf({ from: '2026-09-01', to: '2026-09-10' } as Period, today)).toBe('custom')
  })

  it('recusa período invertido, fora do formato ou maior que um ano', () => {
    expect(isValidPeriod({ from: '2026-09-11', to: '2026-09-01' } as Period)).toBe(false)
    expect(isValidPeriod({ from: '11/09/2026', to: '2026-09-11' } as Period)).toBe(false)
    expect(isValidPeriod({ from: '2025-01-01', to: '2026-09-11' } as Period)).toBe(false)
    expect(isValidPeriod({ from: '2026-09-11', to: '2026-09-11' } as Period)).toBe(true)
  })

  it('a variação não inventa número quando não há base', () => {
    expect(deltaPercent(10, 0)).toBeNull()
    expect(deltaPercent(null, 5)).toBeNull()
    expect(deltaPercent(12, 10)).toBe(20)
    expect(deltaPercent(8, 10)).toBe(-20)
    expect(formatDelta(null)).toBe('sem base')
    expect(formatDelta(20)).toBe('+20%')
  })
})
