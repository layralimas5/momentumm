import { describe, expect, it } from 'vitest'
import { dayKey, shiftDay, streakEndingToday } from './day'

describe('dayKey', () => {
  it('formata como YYYY-MM-DD com zero à esquerda', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('usa o dia local mesmo à noite', () => {
    expect(dayKey(new Date(2026, 6, 22, 23, 59))).toBe('2026-07-22')
  })
})

describe('shiftDay', () => {
  it('anda pra frente e pra trás', () => {
    expect(shiftDay('2026-07-22', 1)).toBe('2026-07-23')
    expect(shiftDay('2026-07-22', -3)).toBe('2026-07-19')
  })

  it('atravessa mês, ano e bissexto', () => {
    expect(shiftDay('2026-07-31', 1)).toBe('2026-08-01')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('streakEndingToday', () => {
  const today = '2026-07-22'

  it('é 0 sem dias ativos', () => {
    expect(streakEndingToday([], today)).toBe(0)
  })

  it('conta dias consecutivos terminando hoje', () => {
    expect(streakEndingToday(['2026-07-20', '2026-07-21', '2026-07-22'], today)).toBe(3)
  })

  it('é tolerante: hoje ainda não ativo conta até ontem', () => {
    expect(streakEndingToday(['2026-07-20', '2026-07-21'], today)).toBe(2)
  })

  it('zera quando nem hoje nem ontem estão ativos', () => {
    expect(streakEndingToday(['2026-07-18', '2026-07-19'], today)).toBe(0)
  })

  it('para no primeiro buraco', () => {
    expect(streakEndingToday(['2026-07-10', '2026-07-21', '2026-07-22'], today)).toBe(2)
  })

  it('aceita Set e ignora duplicatas', () => {
    const dates = new Set(['2026-07-22', '2026-07-22', '2026-07-21'])
    expect(streakEndingToday(dates, today)).toBe(2)
  })
})
