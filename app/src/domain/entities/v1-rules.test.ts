import { describe, expect, it } from 'vitest'
import { addDays, dayKeyOf, parseDayKey, type DayKey } from './day'
import {
  createHabit,
  habitConsistency,
  habitsForDay,
  isHabitRunning,
  scheduledCountBetween,
  weeklyQuotaMet,
  type Habit,
  type HabitLog,
} from './habit'
import {
  createObjective,
  isRunning,
  progressOfObjective,
  stateOf,
  type Objective,
} from './objective'
import { calculateMomentum, momentumFactors, weakestFactor } from './momentum'
import { createTask, isBlocked, isPending, planHorizons, resequence, type Task } from './task'

const TODAY = parseDayKey('2026-09-09')

function habit(overrides: Partial<Parameters<typeof createHabit>[0]> = {}, id = 'h1'): Habit {
  return createHabit(
    {
      userId: 'u1',
      name: 'Ler',
      icon: 'livro',
      axis: 'leitura',
      dayPart: 'noite',
      target: 20,
      ...overrides,
    },
    id,
    new Date('2026-08-01T08:00:00'),
  )
}

function log(habitId: string, day: DayKey, id: string): HabitLog {
  return { id, userId: 'u1', habitId, day, status: 'feito', createdAt: new Date() }
}

function task(overrides: Partial<Parameters<typeof createTask>[0]> = {}, id = 't1'): Task {
  return createTask({ userId: 'u1', title: 'Fazer algo', day: TODAY, ...overrides }, id)
}

function objective(overrides: Partial<Parameters<typeof createObjective>[0]> = {}): Objective {
  return createObjective(
    {
      userId: 'u1',
      title: 'Ler 10 livros',
      axis: 'leitura',
      target: 1000,
      startedOn: addDays(TODAY, -30),
      deadline: addDays(TODAY, 30),
      ...overrides,
    },
    'o1',
    new Date('2026-08-10T08:00:00'),
  )
}

// ---------------------------------------------------------------------------
// Hábito: frequência por cota semanal
// ---------------------------------------------------------------------------

describe('frequência vezes-semana', () => {
  it('não cobra sete dias de um hábito de três vezes', () => {
    const weekly = habit({ frequency: 'vezes-semana', timesPerWeek: 3 })
    expect(scheduledCountBetween(weekly, addDays(TODAY, -6), TODAY)).toBe(3)
  })

  it('hábito diário continua esperando sete', () => {
    expect(scheduledCountBetween(habit(), addDays(TODAY, -6), TODAY)).toBe(7)
  })

  it('dias específicos conta só os dias marcados', () => {
    // Segunda, quarta e sexta numa janela de sete dias.
    const specific = habit({ frequency: 'dias-semana', weekdays: [1, 3, 5] })
    expect(scheduledCountBetween(specific, addDays(TODAY, -6), TODAY)).toBe(3)
  })

  it('não cobra dias anteriores à criação do hábito', () => {
    const novo = createHabit(
      { userId: 'u1', name: 'Novo', icon: 'livro', axis: 'leitura', dayPart: 'noite', target: 10 },
      'h9',
      new Date('2026-09-08T08:00:00'),
    )
    expect(scheduledCountBetween(novo, addDays(TODAY, -6), TODAY)).toBe(2)
  })

  it('cota cumprida tira o hábito do dia', () => {
    const weekly = habit({ frequency: 'vezes-semana', timesPerWeek: 2 })
    const logs = [
      log('h1', parseDayKey('2026-09-07'), 'l1'),
      log('h1', parseDayKey('2026-09-08'), 'l2'),
    ]
    expect(weeklyQuotaMet(weekly, logs, TODAY)).toBe(true)
    expect(habitsForDay([weekly], logs, TODAY)).toHaveLength(0)
  })

  it('cota parcial mantém o hábito na lista do dia', () => {
    const weekly = habit({ frequency: 'vezes-semana', timesPerWeek: 3 })
    const logs = [log('h1', parseDayKey('2026-09-07'), 'l1')]
    expect(habitsForDay([weekly], logs, TODAY)).toHaveLength(1)
  })

  it('exige pelo menos um dia quando a frequência é dias específicos', () => {
    expect(() => habit({ frequency: 'dias-semana', weekdays: [] })).toThrow()
  })

  it('recusa cota fora de 1 a 7', () => {
    expect(() => habit({ frequency: 'vezes-semana', timesPerWeek: 9 })).toThrow()
  })
})

describe('pausa de hábito', () => {
  it('pausado sai do dia sem sair da lista', () => {
    const paused: Habit = { ...habit(), pausedAt: new Date() }
    expect(isHabitRunning(paused)).toBe(false)
    expect(habitsForDay([paused], [], TODAY)).toHaveLength(0)
  })
})

describe('habitConsistency', () => {
  it('mede o que saiu sobre o que era esperado', () => {
    const logs = [
      log('h1', addDays(TODAY, -1), 'l1'),
      log('h1', addDays(TODAY, -2), 'l2'),
    ]
    const rate = habitConsistency(habit(), logs, addDays(TODAY, -6), TODAY)

    expect(rate.expected).toBe(7)
    expect(rate.done).toBe(2)
    expect(rate.rate).toBeCloseTo(2 / 7)
  })

  it('uma falha isolada quase não move a taxa', () => {
    const days = [1, 2, 3, 4, 5, 6].map((offset) => log('h1', addDays(TODAY, -offset), `l${offset}`))
    const rate = habitConsistency(habit(), days, addDays(TODAY, -6), TODAY)
    expect(rate.rate).toBeGreaterThan(0.8)
  })

  it('sem expectativa no período devolve zero em vez de dividir por zero', () => {
    const rate = habitConsistency(habit(), [], addDays(TODAY, -400), addDays(TODAY, -390))
    expect(rate.expected).toBe(0)
    expect(rate.rate).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Ação: dependência, ordem e horizontes
// ---------------------------------------------------------------------------

describe('dependência entre ações', () => {
  it('trava enquanto a anterior não sai', () => {
    const first = task({}, 'a')
    const second = task({ dependsOnId: 'a' }, 'b')
    expect(isBlocked(second, [first, second])).toBe(true)
  })

  it('libera quando a anterior é concluída', () => {
    const first: Task = { ...task({}, 'a'), status: 'feita' }
    const second = task({ dependsOnId: 'a' }, 'b')
    expect(isBlocked(second, [first, second])).toBe(false)
  })

  it('libera quando a anterior é cancelada', () => {
    const first: Task = { ...task({}, 'a'), status: 'cancelada' }
    const second = task({ dependsOnId: 'a' }, 'b')
    expect(isBlocked(second, [first, second])).toBe(false)
  })

  it('dependência apontando pra ação inexistente não trava', () => {
    const orphan = task({ dependsOnId: 'sumiu' }, 'b')
    expect(isBlocked(orphan, [orphan])).toBe(false)
  })
})

describe('estados novos da ação', () => {
  it('em andamento continua pendente', () => {
    expect(isPending({ ...task(), status: 'em-andamento' })).toBe(true)
  })

  it('cancelada não é pendente', () => {
    expect(isPending({ ...task(), status: 'cancelada' })).toBe(false)
  })
})

describe('planHorizons', () => {
  it('separa atrasado de hoje', () => {
    const late = task({ day: addDays(TODAY, -3) }, 'late')
    const now = task({}, 'now')
    const keys = planHorizons([late, now], TODAY).map((horizon) => horizon.key)

    expect(keys).toEqual(['atrasada', 'hoje'])
  })

  it('esconde grupo vazio', () => {
    expect(planHorizons([task()], TODAY)).toHaveLength(1)
  })

  it('ignora concluída e cancelada', () => {
    const done: Task = { ...task({}, 'a'), status: 'feita' }
    const dropped: Task = { ...task({}, 'b'), status: 'cancelada' }
    expect(planHorizons([done, dropped], TODAY)).toHaveLength(0)
  })
})

describe('resequence', () => {
  it('numera a ordem a partir de zero', () => {
    const result = resequence([task({}, 'a'), task({}, 'b'), task({}, 'c')])
    expect(result).toEqual([
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
    ])
  })
})

// ---------------------------------------------------------------------------
// Objetivo: ciclo de vida
// ---------------------------------------------------------------------------

describe('ciclo de vida do objetivo', () => {
  it('sem progresso é não iniciado', () => {
    expect(stateOf(objective(), 0)).toBe('nao-iniciado')
  })

  it('com progresso é em andamento', () => {
    expect(stateOf(objective(), 10)).toBe('em-andamento')
  })

  it('pausado ganha da leitura de progresso', () => {
    const paused: Objective = { ...objective(), pausedAt: new Date() }
    expect(stateOf(paused, 500)).toBe('pausado')
    expect(isRunning(paused)).toBe(false)
  })

  it('concluído ganha de pausado', () => {
    const done: Objective = { ...objective(), pausedAt: new Date(), completedAt: new Date() }
    expect(stateOf(done, 10)).toBe('concluido')
  })

  it('arquivado ganha de tudo', () => {
    const archived: Objective = { ...objective(), completedAt: new Date(), archivedAt: new Date() }
    expect(stateOf(archived, 10)).toBe('arquivado')
  })

  it('concluir na mão conta mesmo sem bater o alvo', () => {
    const done: Objective = { ...objective(), completedAt: new Date() }
    const progress = progressOfObjective(done, [], TODAY)
    expect(progress.status).toBe('concluido')
    expect(progress.state).toBe('concluido')
  })

  it('prioridade padrão é média', () => {
    expect(objective().priority).toBe('media')
  })

  it('pausado não cobra ritmo na leitura', () => {
    const paused: Objective = { ...objective(), pausedAt: new Date() }
    const summary = progressOfObjective(paused, [], TODAY).summary

    expect(summary).toContain('Pausado')
    expect(summary).not.toContain('por dia')
  })

  it('pausado e concluído mostra a conclusão, não a pausa', () => {
    const both: Objective = { ...objective(), pausedAt: new Date(), completedAt: new Date() }
    expect(progressOfObjective(both, [], TODAY).summary).toContain('fechado')
  })
})

// ---------------------------------------------------------------------------
// Momentum: o fator de retomada
// ---------------------------------------------------------------------------

describe('fator de retomada', () => {
  const base = { habits: [], habitLogs: [], tasks: [], today: TODAY } as const

  function activityOn(day: DayKey, id: string) {
    return {
      id,
      userId: 'u1',
      type: 'leitura',
      value: 10,
      unit: 'paginas' as const,
      durationMin: 10,
      note: null,
      day,
      occurredAt: new Date(`${day}T09:00:00`),
      visibility: 'publica' as const,
      source: 'manual' as const,
    }
  }

  it('quem parou e voltou pontua na retomada', () => {
    // Move, para três dias, e volta nos dois últimos.
    const activities = [
      activityOn(addDays(TODAY, -6), 'a1'),
      activityOn(addDays(TODAY, -1), 'a2'),
      activityOn(TODAY, 'a3'),
    ]
    const score = calculateMomentum({ ...base, activities })
    expect(score.parts.recovery).toBe(1)
  })

  it('quem parou e não voltou não pontua', () => {
    const activities = [activityOn(addDays(TODAY, -6), 'a1')]
    const score = calculateMomentum({ ...base, activities })
    expect(score.parts.recovery).toBe(0)
  })

  it('um único dia perdido não zera a retomada', () => {
    const activities = [0, 1, 3, 4, 5, 6].map((offset) =>
      activityOn(addDays(TODAY, -offset), `a${offset}`),
    )
    const score = calculateMomentum({ ...base, activities })
    expect(score.parts.recovery).toBeGreaterThan(0.8)
  })

  it('pesos somam 100 pontos', () => {
    const score = calculateMomentum({ ...base, activities: [] })
    const total = momentumFactors(score).reduce((sum, factor) => sum + factor.maxPoints, 0)
    expect(total).toBe(100)
  })

  it('aponta o fator com mais pontos na mesa', () => {
    const activities = [activityOn(TODAY, 'a1')]
    const score = calculateMomentum({ ...base, activities })
    expect(weakestFactor(score)).not.toBeNull()
  })

  it('score fica entre 0 e 100', () => {
    const activities = [activityOn(TODAY, 'a1')]
    const score = calculateMomentum({ ...base, activities })
    expect(score.value).toBeGreaterThanOrEqual(0)
    expect(score.value).toBeLessThanOrEqual(100)
  })

  it('ação cancelada não derruba a taxa de ações', () => {
    const cancelled: Task = { ...task({}, 'x'), status: 'cancelada' }
    const activities = [activityOn(TODAY, 'a1')]

    const withCancelled = calculateMomentum({ ...base, activities, tasks: [cancelled] })
    const without = calculateMomentum({ ...base, activities, tasks: [] })

    expect(withCancelled.parts.priorities).toBe(without.parts.priorities)
  })
})

describe('dayKeyOf', () => {
  it('continua usando o calendário local', () => {
    expect(dayKeyOf(new Date(2026, 8, 9, 23, 30))).toBe('2026-09-09')
  })
})
