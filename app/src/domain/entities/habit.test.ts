import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { addDays, parseDayKey, type DayKey } from './day'
import {
  createHabit,
  frequencyLabel,
  habitDayProgress,
  habitDayStates,
  habitStreak,
  isScheduledOn,
  statusOf,
  type Habit,
  type HabitLog,
  type HabitStatus,
} from './habit'

// 03/09/2026 é uma quinta-feira.
const TODAY = parseDayKey('2026-09-03')
const CREATED = new Date(2026, 7, 1, 12)

function habit(overrides: Partial<Parameters<typeof createHabit>[0]> = {}): Habit {
  return createHabit(
    {
      userId: 'u1',
      name: 'Ler antes de dormir',
      icon: 'livro',
      axis: 'leitura',
      dayPart: 'noite',
      target: 30,
      ...overrides,
    },
    'h1',
    CREATED,
  )
}

function log(day: DayKey, status: HabitStatus, habitId = 'h1'): HabitLog {
  return { id: `${habitId}-${day}`, userId: 'u1', habitId, day, status, createdAt: new Date() }
}

describe('createHabit', () => {
  it('deriva a versão mínima como um terço do alvo', () => {
    expect(habit({ target: 30 }).minimalTarget).toBe(10)
  })

  it('nunca deixa a versão mínima abaixo de um', () => {
    expect(habit({ target: 1 }).minimalTarget).toBe(1)
  })

  it('não deixa a versão mínima passar do alvo', () => {
    expect(habit({ target: 10, minimalTarget: 40 }).minimalTarget).toBe(10)
  })

  it('recusa nome curto demais', () => {
    expect(() => habit({ name: 'a' })).toThrow(DomainError)
  })

  it('guarda os sete dias da semana como "todos os dias"', () => {
    const daily = habit({ weekdays: [0, 1, 2, 3, 4, 5, 6] })
    expect(daily.weekdays).toEqual([])
    expect(frequencyLabel(daily)).toBe('Todos os dias')
  })

  it('descarta dia da semana inválido', () => {
    expect(habit({ weekdays: [1, 9, 3] }).weekdays).toEqual([1, 3])
  })
})

describe('isScheduledOn', () => {
  it('sem dias marcados vale pra todo dia', () => {
    expect(isScheduledOn(habit(), TODAY)).toBe(true)
  })

  it('respeita os dias escolhidos', () => {
    const training = habit({ weekdays: [1, 3, 5] })
    expect(isScheduledOn(training, TODAY)).toBe(false)
    expect(isScheduledOn(training, addDays(TODAY, -1))).toBe(true)
  })
})

describe('habitStreak', () => {
  it('conta dias consecutivos cumpridos', () => {
    const logs = [-3, -2, -1].map((offset) => log(addDays(TODAY, offset), 'feito'))
    expect(habitStreak(habit(), logs, TODAY)).toBe(3)
  })

  it('hoje ainda pendente não quebra a sequência', () => {
    const logs = [log(addDays(TODAY, -1), 'feito')]
    expect(habitStreak(habit(), logs, TODAY)).toBe(1)
  })

  it('versão mínima conta como cumprido', () => {
    const logs = [log(addDays(TODAY, -1), 'minimo'), log(TODAY, 'minimo')]
    expect(habitStreak(habit(), logs, TODAY)).toBe(2)
  })

  it('pular conscientemente quebra a sequência, sem drama', () => {
    const logs = [log(addDays(TODAY, -2), 'feito'), log(addDays(TODAY, -1), 'pulado')]
    expect(habitStreak(habit(), logs, TODAY)).toBe(0)
  })

  it('dia fora da frequência não quebra a sequência', () => {
    // Hábito de segunda, quarta e sexta: sábado e domingo não contam contra.
    const training = habit({ weekdays: [1, 3, 5] })
    const logs = [
      log(parseDayKey('2026-08-31'), 'feito'),
      log(parseDayKey('2026-09-02'), 'feito'),
    ]
    expect(habitStreak(training, logs, parseDayKey('2026-09-02'))).toBe(2)
  })

  it('sem nenhum registro a sequência é zero', () => {
    expect(habitStreak(habit(), [], TODAY)).toBe(0)
  })
})

describe('habitDayStates', () => {
  it('traz só os hábitos programados pro dia', () => {
    const daily = habit()
    const training = createHabit(
      {
        userId: 'u1',
        name: 'Treinar',
        icon: 'halter',
        axis: 'treino',
        dayPart: 'tarde',
        weekdays: [1, 3, 5],
        target: 45,
      },
      'h2',
      CREATED,
    )

    const states = habitDayStates([daily, training], [], TODAY)
    expect(states.map((state) => state.habit.id)).toEqual(['h1'])
  })

  it('resume o progresso do dia', () => {
    const states = habitDayStates([habit()], [log(TODAY, 'feito')], TODAY)
    expect(habitDayProgress(states)).toMatchObject({ total: 1, done: 1, allDone: true })
  })
})

describe('statusOf', () => {
  it('sem registro o hábito é pendente', () => {
    expect(statusOf([], 'h1', TODAY)).toBe('pendente')
  })
})
