import { describe, expect, it } from 'vitest'
import { parseDayKey } from './day'
import { EMPTY_QUIZ_ANSWERS, type QuizAnswers } from './quiz'
import { formatCompactTime, formatTotalTime, quizTimeBank } from './quiz-time-bank'

// 2026-10-13 é uma terça.
const today = parseDayKey('2026-10-13')
const answers: QuizAnswers = { ...EMPTY_QUIZ_ANSWERS, time: '20', horizon: '30', weekdays: [1, 3, 5] }

describe('a conta do tempo reservado', () => {
  it('conta só os dias da semana marcados, pelo calendário', () => {
    const bank = quizTimeBank(answers, today)!
    // 30 dias a partir de terça 13/10: segundas, quartas e sextas até 11/11.
    expect(bank.sessions).toBe(13)
    expect(bank.totalMinutes).toBe(13 * 20)
    expect(bank.weeklyMinutes).toBe(60)
  })

  it('cada semana soma o que cabe nela, e o total bate com as semanas', () => {
    const bank = quizTimeBank(answers, today)!
    expect(bank.weeks).toHaveLength(5)
    expect(bank.weeks.reduce((sum, week) => sum + week, 0)).toBe(bank.totalMinutes)
  })

  it('sem prazo escolhido, usa o que o plano assume e diz isso', () => {
    expect(quizTimeBank({ ...answers, horizon: 'nao_sei' }, today)!.assumedDeadline).toBe(true)
  })

  it('sem tempo, prazo ou dias, não há conta', () => {
    expect(quizTimeBank({ ...answers, weekdays: [] }, today)).toBeNull()
    expect(quizTimeBank({ ...answers, time: null }, today)).toBeNull()
  })
})

describe('o total escrito', () => {
  it('fala minutos, horas cheias ou horas e minutos', () => {
    expect(formatTotalTime(40)).toBe('40 minutos')
    expect(formatTotalTime(60)).toBe('1 hora')
    expect(formatTotalTime(780)).toBe('13 horas')
    expect(formatTotalTime(760)).toBe('12h40')
  })

  it('no contador, cabe numa linha', () => {
    expect(formatCompactTime(0)).toBe('0 min')
    expect(formatCompactTime(780)).toBe('13h')
    expect(formatCompactTime(760)).toBe('12h40')
  })
})
