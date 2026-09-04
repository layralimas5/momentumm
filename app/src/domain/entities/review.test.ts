import { describe, expect, it } from 'vitest'
import { createActivity, type Activity } from './activity'
import { createCheckIn, type CheckIn } from './checkin'
import { addDays, parseDayKey, type DayKey } from './day'
import { createHabit, type Habit, type HabitLog, type HabitStatus } from './habit'
import { createTask, type Task, type TaskStatus } from './task'
import { percent, reviewWeek, weekRangeLabel, type ReviewInput } from './review'

// 2026-08-13 é uma quinta-feira.
const TODAY = parseDayKey('2026-08-13')

const DAILY_HABIT: Habit = createHabit(
  { userId: 'u1', name: 'Ler todo dia', icon: 'livro', axis: 'leitura', dayPart: 'noite', target: 20 },
  'h1',
  new Date(2026, 5, 1),
)

function reading(offset: number, value: number, hour = 9): Activity {
  const day = addDays(TODAY, offset)
  const [year, month, date] = day.split('-').map(Number) as [number, number, number]
  return createActivity(
    { userId: 'u1', type: 'leitura', value, occurredAt: new Date(year, month - 1, date, hour) },
    `a-${offset}-${value}`,
  )
}

function log(offset: number, status: HabitStatus = 'feito'): HabitLog {
  return {
    id: `l-${offset}`,
    userId: 'u1',
    habitId: DAILY_HABIT.id,
    day: addDays(TODAY, offset),
    status,
    createdAt: new Date(),
  }
}

function task(offset: number, status: TaskStatus): Task {
  const base = createTask(
    { userId: 'u1', title: `Ação ${offset}`, day: addDays(TODAY, offset) },
    `t-${offset}-${status}`,
  )
  return { ...base, status }
}

function checkIn(offset: number, energy: 1 | 2 | 3 | 4 | 5): CheckIn {
  return createCheckIn(
    {
      userId: 'u1',
      day: addDays(TODAY, offset),
      mood: energy <= 2 ? 'sem-energia' : 'estavel',
      energy,
      focus: 'oscilando',
    },
    `c-${offset}`,
  )
}

function input(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    activities: [],
    habits: [],
    habitLogs: [],
    tasks: [],
    checkIns: [],
    objectives: [],
    today: TODAY,
    ...overrides,
  }
}

describe('reviewWeek', () => {
  it('semana vazia não conclui nada e manda recomeçar pequeno', () => {
    const review = reviewWeek(input())
    expect(review.ready).toBe(false)
    expect(review.lost).toHaveLength(0)
    expect(review.gained).toHaveLength(0)
    expect(review.recommendation.action).toBe('retomar-do-zero')
  })

  it('a janela é de sete dias terminando hoje', () => {
    const review = reviewWeek(input())
    expect(review.end).toBe(TODAY)
    expect(review.start).toBe(addDays(TODAY, -6))
  })

  it('weeksAgo anda a janela pra trás', () => {
    const review = reviewWeek(input({ weeksAgo: 1 }))
    expect(review.end).toBe(addDays(TODAY, -7))
    expect(review.start).toBe(addDays(TODAY, -13))
  })

  it('a execução compara cumprido com planejado', () => {
    const review = reviewWeek(
      input({
        habits: [DAILY_HABIT],
        habitLogs: [-6, -5, -4, -3, -2, -1, 0].map((offset) => log(offset)),
        activities: [reading(-1, 20)],
      }),
    )
    // Sete dias programados, sete cumpridos.
    expect(review.execution.habitsPlanned).toBe(7)
    expect(review.execution.habitsDone).toBe(7)
    expect(review.execution.rate).toBe(1)
  })

  it('não cobra dias anteriores à criação do hábito', () => {
    // Hábito criado hoje: a primeira review não pode nascer devendo seis dias.
    const novo = createHabit(
      {
        userId: 'u1',
        name: 'Estudar todo dia',
        icon: 'cerebro',
        axis: 'estudo',
        dayPart: 'qualquer',
        target: 30,
      },
      'h-novo',
      new Date(2026, 7, 13, 9),
    )

    const review = reviewWeek(input({ habits: [novo] }))
    expect(review.execution.habitsPlanned).toBe(1)
    expect(review.lost.some((point) => point.id === 'habito-h-novo')).toBe(false)
  })

  it('versão mínima conta como cumprido, como no resto do produto', () => {
    const review = reviewWeek(
      input({ habits: [DAILY_HABIT], habitLogs: [log(-1, 'minimo'), log(-2, 'feito')] }),
    )
    expect(review.execution.habitsDone).toBe(2)
  })

  it('aponta os dias sem registro como perda de ritmo', () => {
    const review = reviewWeek(
      input({
        habits: [DAILY_HABIT],
        habitLogs: [-6, -5, -4, -3, -2].map((offset) => log(offset)),
        activities: [reading(-6, 20), reading(-5, 20), reading(-4, 20), reading(-3, 20)],
      }),
    )
    expect(review.lost.some((point) => point.id === 'dias-vazios')).toBe(true)
  })

  it('aponta o hábito que mais ficou pra trás', () => {
    const review = reviewWeek(
      input({
        habits: [DAILY_HABIT],
        habitLogs: [log(-6), log(-5)],
        activities: [reading(-6, 20), reading(-5, 20), reading(-1, 20)],
      }),
    )
    expect(review.lost.some((point) => point.id === `habito-${DAILY_HABIT.id}`)).toBe(true)
  })

  it('duas ações adiadas viram um ponto de atenção', () => {
    const review = reviewWeek(
      input({
        tasks: [task(-1, 'adiada'), task(-2, 'adiada')],
        activities: [reading(-1, 20), reading(-2, 20)],
      }),
    )
    expect(review.lost.some((point) => point.id === 'acoes-adiadas')).toBe(true)
  })

  it('mais presença que na semana anterior aparece como evolução', () => {
    const review = reviewWeek(
      input({ activities: [reading(-1, 20), reading(-2, 20), reading(-3, 20)] }),
    )
    expect(review.gained.some((point) => point.id === 'presenca')).toBe(true)
  })

  it('execução baixa com plano cheio manda planejar menos', () => {
    const review = reviewWeek(
      input({
        habits: [DAILY_HABIT],
        habitLogs: [log(-1), log(-2)],
        activities: [reading(-1, 20), reading(-2, 20)],
      }),
    )
    expect(review.recommendation.action).toBe('reduzir-carga')
  })

  it('execução alta com presença manda subir um degrau', () => {
    const days = [-6, -5, -4, -3, -2, -1, 0]
    const review = reviewWeek(
      input({
        habits: [DAILY_HABIT],
        habitLogs: days.map((offset) => log(offset)),
        activities: days.map((offset) => reading(offset, 20)),
      }),
    )
    expect(review.recommendation.action).toBe('aumentar-carga')
  })

  it('energia baixa a semana toda sugere trocar o horário', () => {
    const days = [-4, -3, -2, -1]
    const review = reviewWeek(
      input({
        activities: days.map((offset) => reading(offset, 20)),
        checkIns: days.map((offset) => checkIn(offset, 2)),
      }),
    )
    expect(review.recommendation.action).toBe('trocar-horario')
  })

  it('a leitura nunca inventa: sem plano, a execução é zero e não vira queda', () => {
    const review = reviewWeek(input({ activities: [reading(-1, 20), reading(-2, 20)] }))
    expect(review.execution.planned).toBe(0)
    expect(review.lost.some((point) => point.id === 'execucao-caiu')).toBe(false)
  })
})

describe('percent', () => {
  it('arredonda e trava entre 0 e 100', () => {
    expect(percent(0.674)).toBe('67%')
    expect(percent(1.5)).toBe('100%')
    expect(percent(-1)).toBe('0%')
  })
})

describe('weekRangeLabel', () => {
  it('mostra as duas pontas da semana', () => {
    const label = weekRangeLabel(addDays(TODAY, -6) as DayKey, TODAY)
    expect(label).toContain(' a ')
  })
})
