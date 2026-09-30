import { describe, expect, it } from 'vitest'
import { parseDayKey } from './day'
import { addMonths, formatMonthLabel, isSameMonth, monthGridDays, startOfMonthKey } from './month'

describe('month', () => {
  it('volta pro dia 1 do mês', () => {
    expect(startOfMonthKey(parseDayKey('2026-11-18'))).toBe('2026-11-01')
  })

  it('anda de mês sem escorregar no dia 31', () => {
    expect(addMonths(parseDayKey('2026-01-31'), 1)).toBe('2026-02-01')
    expect(addMonths(parseDayKey('2026-01-15'), -1)).toBe('2025-12-01')
  })

  it('compara meses ignorando o dia', () => {
    expect(isSameMonth(parseDayKey('2026-11-01'), parseDayKey('2026-11-30'))).toBe(true)
    expect(isSameMonth(parseDayKey('2026-11-30'), parseDayKey('2026-12-01'))).toBe(false)
  })

  it('escreve o mês por extenso com o ano', () => {
    expect(formatMonthLabel(parseDayKey('2026-11-18'))).toBe('Novembro 2026')
  })

  describe('a grade', () => {
    it('começa na segunda e fecha em semanas inteiras', () => {
      const days = monthGridDays(parseDayKey('2026-11-10'))

      expect(days.length % 7).toBe(0)
      // 1º de novembro de 2026 é um domingo: ele fecha a semana que começou em
      // 26 de outubro, e 30 de novembro (segunda) abre a última linha, que vai
      // até 6 de dezembro.
      expect(days[0]).toBe('2026-10-26')
      expect(days.at(-1)).toBe('2026-12-06')
    })

    it('cobre o mês inteiro, do dia 1 ao último', () => {
      const days = monthGridDays(parseDayKey('2026-02-05'))

      expect(days).toContain('2026-02-01')
      expect(days).toContain('2026-02-28')
      expect(days).not.toContain('2026-03-02')
    })

    it('não deixa linha inteira fora do mês', () => {
      // Março de 2026 começa num domingo: sem cuidado, a grade ganharia uma
      // primeira linha só com fevereiro.
      const days = monthGridDays(parseDayKey('2026-03-01'))
      const firstWeek = days.slice(0, 7)

      expect(firstWeek.some((day) => day.startsWith('2026-03'))).toBe(true)
    })
  })
})
