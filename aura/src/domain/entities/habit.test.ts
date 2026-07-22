import { describe, expect, it } from 'vitest'
import { HabitRules } from './habit'

/** Monta o mínimo que cada regra precisa, sem arrastar a entidade inteira. */
function completed(dates: string[], createdAt = '2026-01-01T00:00:00.000Z') {
  return { completedDates: dates, createdAt }
}

describe('HabitRules.isValidTitle', () => {
  it('aceita títulos dentro do limite', () => {
    expect(HabitRules.isValidTitle('Beber água')).toBe(true)
    expect(HabitRules.isValidTitle('ab')).toBe(true)
    expect(HabitRules.isValidTitle('a'.repeat(80))).toBe(true)
  })

  it('rejeita curto demais, longo demais e só espaço', () => {
    expect(HabitRules.isValidTitle('a')).toBe(false)
    expect(HabitRules.isValidTitle('a'.repeat(81))).toBe(false)
    expect(HabitRules.isValidTitle('   ')).toBe(false)
  })

  it('ignora espaços nas bordas ao medir', () => {
    expect(HabitRules.isValidTitle('  ab  ')).toBe(true)
    expect(HabitRules.isValidTitle('  a  ')).toBe(false)
  })
})

describe('HabitRules.dayKey', () => {
  it('formata como YYYY-MM-DD com zero à esquerda', () => {
    expect(HabitRules.dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(HabitRules.dayKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('usa o dia local, não o UTC', () => {
    // 23h local nunca deve virar o dia seguinte.
    const lateNight = new Date(2026, 6, 22, 23, 30)
    expect(HabitRules.dayKey(lateNight)).toBe('2026-07-22')
  })
})

describe('HabitRules.shift', () => {
  it('anda pra frente e pra trás', () => {
    expect(HabitRules.shift('2026-07-22', 1)).toBe('2026-07-23')
    expect(HabitRules.shift('2026-07-22', -1)).toBe('2026-07-21')
    expect(HabitRules.shift('2026-07-22', 0)).toBe('2026-07-22')
  })

  it('atravessa mês e ano', () => {
    expect(HabitRules.shift('2026-07-31', 1)).toBe('2026-08-01')
    expect(HabitRules.shift('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('respeita ano bissexto', () => {
    expect(HabitRules.shift('2028-02-28', 1)).toBe('2028-02-29')
    expect(HabitRules.shift('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('HabitRules.routineProgress', () => {
  const day = '2026-07-22'

  it('é 0 quando não há hábitos — sem divisão por zero', () => {
    expect(HabitRules.routineProgress([], day)).toBe(0)
  })

  it('mede a fração concluída no dia', () => {
    const habits = [completed([day]), completed([]), completed([day]), completed([])]
    expect(HabitRules.routineProgress(habits, day)).toBe(50)
  })

  it('arredonda para inteiro', () => {
    const habits = [completed([day]), completed([]), completed([])]
    expect(HabitRules.routineProgress(habits, day)).toBe(33)
  })

  it('chega a 100 com tudo feito', () => {
    expect(HabitRules.routineProgress([completed([day]), completed([day])], day)).toBe(100)
  })
})

describe('HabitRules.streak', () => {
  const today = '2026-07-22'

  it('é 0 sem histórico', () => {
    expect(HabitRules.streak(completed([]), today)).toBe(0)
  })

  it('conta dias consecutivos terminando hoje', () => {
    const dates = ['2026-07-20', '2026-07-21', '2026-07-22']
    expect(HabitRules.streak(completed(dates), today)).toBe(3)
  })

  it('é tolerante: hoje ainda não feito conta a sequência até ontem', () => {
    const dates = ['2026-07-20', '2026-07-21']
    expect(HabitRules.streak(completed(dates), today)).toBe(2)
  })

  it('zera quando nem hoje nem ontem foram feitos', () => {
    const dates = ['2026-07-18', '2026-07-19', '2026-07-20']
    expect(HabitRules.streak(completed(dates), today)).toBe(0)
  })

  it('para no primeiro buraco — não soma dias soltos', () => {
    const dates = ['2026-07-10', '2026-07-11', '2026-07-21', '2026-07-22']
    expect(HabitRules.streak(completed(dates), today)).toBe(2)
  })

  it('ignora dias no futuro', () => {
    const dates = ['2026-07-22', '2026-07-25']
    expect(HabitRules.streak(completed(dates), today)).toBe(1)
  })

  it('atravessa a virada de mês', () => {
    const dates = ['2026-06-30', '2026-07-01']
    expect(HabitRules.streak(completed(dates), '2026-07-01')).toBe(2)
  })
})

describe('HabitRules.completionRate', () => {
  it('é 0 para um hábito criado no futuro — janela vazia', () => {
    const habit = completed([], '2026-08-01T00:00:00.000Z')
    expect(HabitRules.completionRate(habit, '2026-07-22')).toBe(0)
  })

  it('é 100 com todos os dias da janela concluídos', () => {
    const today = '2026-07-22'
    const dates = Array.from({ length: 30 }, (_, i) => HabitRules.shift(today, -i))
    const habit = completed(dates, '2026-01-01T00:00:00.000Z')
    expect(HabitRules.completionRate(habit, today, 30)).toBe(100)
  })

  it('conta apenas desde a criação, não penaliza dias anteriores', () => {
    // Criado hoje e feito hoje: 1 de 1 dia possível.
    const habit = completed(['2026-07-22'], '2026-07-22T10:00:00.000Z')
    expect(HabitRules.completionRate(habit, '2026-07-22', 30)).toBe(100)
  })

  it('mede a fração dentro da janela informada', () => {
    const today = '2026-07-22'
    const dates = ['2026-07-22', '2026-07-21', '2026-07-20', '2026-07-19', '2026-07-18']
    const habit = completed(dates, '2026-01-01T00:00:00.000Z')
    expect(HabitRules.completionRate(habit, today, 10)).toBe(50)
  })
})
