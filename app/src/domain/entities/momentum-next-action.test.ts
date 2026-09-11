import { describe, expect, it } from 'vitest'
import { createActivity } from './activity'
import { addDays, dayKeyToDate, parseDayKey, type DayKey } from './day'
import { createHabit, type Habit, type HabitLog } from './habit'
import { calculateMomentum, type MomentumInput } from './momentum'
import { bestNextAction } from './momentum-next-action'
import { createTask, type Task } from './task'

const TODAY = parseDayKey('2026-09-03')

const HABIT: Habit = createHabit(
  { userId: 'u1', name: 'Ler', icon: 'livro', axis: 'leitura', dayPart: 'noite', target: 20 },
  'h1',
  new Date(2026, 0, 1),
)

function log(day: DayKey): HabitLog {
  return { id: `l-${day}`, userId: 'u1', habitId: 'h1', day, status: 'feito', createdAt: new Date() }
}

function task(day: DayKey, id: string, overrides: Partial<Task> = {}): Task {
  return { ...createTask({ userId: 'u1', title: `Ação ${id}`, day }, id), ...overrides }
}

function activityOn(day: DayKey) {
  const base = dayKeyToDate(day)
  return createActivity(
    {
      userId: 'u1',
      type: 'leitura',
      value: 20,
      occurredAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9),
    },
    `a-${day}`,
  )
}

/** Três semanas de história com movimento em dias alternados. */
function history(): Pick<MomentumInput, 'activities' | 'habitLogs' | 'tasks'> {
  const days = Array.from({ length: 21 }, (_, index) => addDays(TODAY, -(index + 1)))
  return {
    activities: days.filter((_, index) => index % 2 === 0).map(activityOn),
    habitLogs: days.filter((_, index) => index % 2 === 0).map(log),
    tasks: days.map((day, index) =>
      task(day, `h${index}`, { status: index % 2 === 0 ? 'feita' : 'cancelada' }),
    ),
  }
}

function input(overrides: Partial<MomentumInput> = {}): MomentumInput {
  return { habits: [HABIT], today: TODAY, ...history(), ...overrides }
}

describe('bestNextAction', () => {
  it('sem nada em aberto não sugere nada', () => {
    expect(bestNextAction(input({ habits: [] }))).toBeNull()
  })

  it('escolhe o item que mais sobe o score, pela mesma fórmula do número', () => {
    const data = input({
      tasks: [
        ...history().tasks,
        task(TODAY, 'comum'),
        task(TODAY, 'principal', { isMainPriority: true }),
      ],
    })
    const chosen = bestNextAction(data)

    expect(chosen?.id).toBe('principal')
    expect(chosen?.kind).toBe('acao')
    expect(chosen?.rawGain).toBeGreaterThan(0)

    // O ganho prometido é o ganho real: simular a conclusão dá o mesmo número.
    const simulated = calculateMomentum({
      ...data,
      tasks: data.tasks.map((item) =>
        item.id === 'principal' ? { ...item, status: 'feita' as const } : item,
      ),
    })
    expect(simulated.value - calculateMomentum(data).value).toBe(chosen?.gain)
  })

  it('ação vencida entra como se fosse trazida pra hoje, e o motivo diz isso', () => {
    const chosen = bestNextAction(
      input({
        tasks: [...history().tasks, task(addDays(TODAY, -2), 'atrasada', { isMainPriority: true })],
        habits: [],
      }),
    )
    expect(chosen?.id).toBe('atrasada')
    expect(chosen?.reason).toContain('vencida')
  })

  it('hábito programado pra hoje é candidato quando não há ação', () => {
    const chosen = bestNextAction(input({ tasks: history().tasks }))
    expect(chosen?.kind).toBe('habito')
    expect(chosen?.id).toBe('h1')
  })

  it('ação travada por dependência não é sugerida', () => {
    const chosen = bestNextAction(
      input({
        habits: [],
        tasks: [
          ...history().tasks,
          task(TODAY, 'pai'),
          task(TODAY, 'filha', { dependsOnId: 'pai', isMainPriority: true }),
        ],
      }),
    )
    expect(chosen?.id).toBe('pai')
  })

  it('o ganho exibido nunca é negativo, e o motivo cita o fator que mais sobe', () => {
    const chosen = bestNextAction(
      input({ tasks: [...history().tasks, task(TODAY, 'p', { isMainPriority: true })] }),
    )
    expect(chosen?.gain ?? 0).toBeGreaterThanOrEqual(0)
    expect(chosen?.reason).toContain('puxado por')
  })
})
