import { describe, expect, it } from 'vitest'
import type { Activity } from './activity'
import type { CheckIn } from './checkin'
import { parseDayKey } from './day'
import { summarizeDay, type DaySummaryInput } from './day-summary'
import type { Habit, HabitLog } from './habit'
import type { Task } from './task'
import type { Win } from './win'

const TERCA = parseDayKey('2026-09-22')
const QUARTA = parseDayKey('2026-09-23')

function activity(day: string, minutes: number): Activity {
  return {
    id: `a-${day}-${minutes}`,
    userId: 'lay',
    type: 'estudo',
    value: minutes,
    unit: 'minutos',
    durationMin: minutes,
    note: null,
    day: parseDayKey(day),
    startedAt: null,
    occurredAt: new Date(`${day}T10:00:00`),
    visibility: 'privada',
    source: 'manual',
  }
}

function habit(id: string, name: string): Habit {
  return {
    id,
    userId: 'lay',
    name,
    icon: 'livro',
    frequency: 'diario',
    weekdays: [],
    objectiveId: null,
    stageId: null,
    axis: null,
    minimalVersion: null,
    period: null,
    order: 0,
    createdAt: new Date('2026-01-01'),
    archivedAt: null,
    pausedAt: null,
  } as unknown as Habit
}

function log(habitId: string, day: string, status: 'feito' | 'pulado'): HabitLog {
  return {
    id: `l-${habitId}-${day}`,
    userId: 'lay',
    habitId,
    day: parseDayKey(day),
    status,
    createdAt: new Date(`${day}T20:00:00`),
  } as unknown as HabitLog
}

function task(id: string, day: string, done: boolean): Task {
  return {
    id,
    userId: 'lay',
    title: `Ação ${id}`,
    status: done ? 'feita' : 'pendente',
    day: parseDayKey(day),
    effort: 'medio',
    estimatedMin: 30,
    minimalVersion: null,
    isMainPriority: false,
    objectiveId: null,
    stageId: null,
    goalId: null,
    axis: null,
    createdAt: new Date('2026-09-01'),
    completedAt: done ? new Date(`${day}T18:00:00`) : null,
  } as unknown as Task
}

const base: DaySummaryInput = {
  activities: [activity('2026-09-22', 45), activity('2026-09-23', 20)],
  habits: [habit('h1', 'Ler 10 páginas'), habit('h2', 'Treinar')],
  habitLogs: [log('h1', '2026-09-22', 'feito'), log('h2', '2026-09-22', 'pulado')],
  tasks: [task('t1', '2026-09-22', true), task('t2', '2026-09-22', false)],
  checkIns: [
    { id: 'c1', userId: 'lay', day: TERCA, mood: 'estavel', energy: 3, focus: 'media', note: null, createdAt: new Date() } as unknown as CheckIn,
  ],
  wins: [{ id: 'w1', userId: 'lay', day: TERCA, text: 'Fechei o dia', createdAt: new Date() } as unknown as Win],
}

describe('summarizeDay', () => {
  it('traz só o que é daquele dia', () => {
    const terca = summarizeDay(base, TERCA)

    expect(terca.activities).toHaveLength(1)
    expect(terca.focusMinutes).toBe(45)
    expect(terca.tasksDone).toHaveLength(1)
    expect(terca.tasksOpen).toHaveLength(1)
    expect(terca.win?.text).toBe('Fechei o dia')
    expect(terca.checkIn?.energy).toBe(3)
  })

  it('conta hábito pulado como não feito', () => {
    const terca = summarizeDay(base, TERCA)

    expect(terca.habits).toHaveLength(2)
    expect(terca.habitsDone).toBe(1)
    expect(terca.habits.find((item) => item.id === 'h2')?.done).toBe(false)
  })

  it('houve movimento quando alguma coisa saiu', () => {
    expect(summarizeDay(base, TERCA).moved).toBe(true)
    // Quarta tem atividade registrada e nenhum hábito marcado.
    expect(summarizeDay(base, QUARTA).moved).toBe(true)
  })

  it('dia sem nada é dia vazio, e vazio não é movimento', () => {
    const vazio = summarizeDay(
      { activities: [], habits: [], habitLogs: [], tasks: [], checkIns: [], wins: [] },
      TERCA,
    )

    expect(vazio.empty).toBe(true)
    expect(vazio.moved).toBe(false)
    expect(vazio.focusMinutes).toBe(0)
  })

  it('dia com hábito pendente não é vazio: havia o que fazer', () => {
    const resumo = summarizeDay(
      { ...base, activities: [], tasks: [], checkIns: [], wins: [], habitLogs: [] },
      TERCA,
    )

    expect(resumo.empty).toBe(false)
    expect(resumo.moved).toBe(false)
    expect(resumo.habitsDone).toBe(0)
  })
})
