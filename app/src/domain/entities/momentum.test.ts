import { describe, expect, it } from 'vitest'
import { createActivity, type Activity } from './activity'
import { CAPACITY_PROFILES } from './checkin'
import { addDays, dayKeyToDate, parseDayKey, type DayKey } from './day'
import { createHabit, type Habit, type HabitLog } from './habit'
import {
  calculateMomentum,
  dailySeries,
  DEFAULT_MOMENTUM_WEIGHTS,
  heldBackNote,
  MAX_DAILY_DROP,
  MAX_DAILY_RISE,
  MAX_REST_WEEKDAYS,
  momentumFactors,
  momentumHistory,
  MOMENTUM_FORMULA,
  MOMENTUM_HORIZON_DAYS,
  MOMENTUM_RULES,
  normalizeRestWeekdays,
  POSTPONED_WEIGHT,
  PRIORITIES_CAP_WITHOUT_PRIORITY,
  recommendationFor,
  type MomentumInput,
} from './momentum'
import { habitImpact, taskImpact } from './momentum-impact'
import { createTask, type Task } from './task'

const TODAY = parseDayKey('2026-09-03')

function activityOn(day: DayKey, value = 30, hour = 9): Activity {
  const base = dayKeyToDate(day)
  return createActivity(
    {
      userId: 'u1',
      type: 'estudo',
      value,
      occurredAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour),
    },
    `a-${day}-${hour}`,
  )
}

const HABIT: Habit = createHabit(
  { userId: 'u1', name: 'Estudar', icon: 'cerebro', axis: 'estudo', dayPart: 'manha', target: 30 },
  'h1',
  new Date(2026, 0, 1),
)

function habitLog(day: DayKey): HabitLog {
  return { id: `l-${day}`, userId: 'u1', habitId: 'h1', day, status: 'feito', createdAt: new Date() }
}

function taskOn(day: DayKey, status: Task['status'], id: string): Task {
  return { ...createTask({ userId: 'u1', title: 'Estudar', day }, id), status }
}

/** Um dia cumprido de verdade: prioridade do dia, hábito e registro. */
function fullDay(offset: number): Pick<MomentumInput, 'activities' | 'habitLogs' | 'tasks'> {
  const day = addDays(TODAY, -offset)
  return {
    activities: [activityOn(day, 30)],
    habitLogs: [habitLog(day)],
    tasks: [{ ...taskOn(day, 'feita', `t${offset}`), isMainPriority: true }],
  }
}

function week(days = 7): MomentumInput {
  const built = Array.from({ length: days }, (_, index) => fullDay(index))
  return input({
    habits: [HABIT],
    activities: built.flatMap((item) => item.activities),
    habitLogs: built.flatMap((item) => item.habitLogs),
    tasks: built.flatMap((item) => item.tasks),
  })
}

function input(overrides: Partial<MomentumInput> = {}): MomentumInput {
  return {
    activities: [],
    habits: [],
    habitLogs: [],
    tasks: [],
    today: TODAY,
    ...overrides,
  }
}

describe('calculateMomentum', () => {
  it('sem nenhum dado o ritmo é zero e desacelerando', () => {
    const score = calculateMomentum(input())
    expect(score.value).toBe(0)
    expect(score.level).toBe('desacelerando')
    expect(score.explanation).toContain('registro suficiente')
  })

  it('constância diária vale mais que volume concentrado', () => {
    const spread = calculateMomentum(
      input({
        activities: Array.from({ length: 7 }, (_, index) => activityOn(addDays(TODAY, -index), 10)),
      }),
    )
    const single = calculateMomentum(input({ activities: [activityOn(TODAY, 400)] }))

    expect(spread.value).toBeGreaterThan(single.value)
    expect(spread.activeDays).toBe(7)
  })

  it('reconhece quem está retomando depois de uma semana parada', () => {
    // Nada na janela anterior, movimento nos últimos dias.
    const score = calculateMomentum(
      input({
        activities: [-3, -2, -1, 0].map((offset) => activityOn(addDays(TODAY, offset), 20)),
      }),
    )
    expect(score.delta).toBeGreaterThan(0)
    expect(['retomando', 'constante', 'avancando']).toContain(score.level)
  })

  it('hábito cumprido entra na conta', () => {
    const withHabits = calculateMomentum(
      input({
        activities: [activityOn(TODAY)],
        habits: [HABIT],
        habitLogs: [-2, -1, 0].map((offset) => habitLog(addDays(TODAY, offset))),
      }),
    )
    const withoutHabits = calculateMomentum(
      input({ activities: [activityOn(TODAY)], habits: [HABIT] }),
    )

    expect(withHabits.value).toBeGreaterThan(withoutHabits.value)
  })

  it('ação concluída pesa mais que ação planejada e abandonada', () => {
    const done = calculateMomentum(
      input({ activities: [activityOn(TODAY)], tasks: [taskOn(TODAY, 'feita', 't1')] }),
    )
    const pending = calculateMomentum(
      input({ activities: [activityOn(TODAY)], tasks: [taskOn(TODAY, 'pendente', 't1')] }),
    )

    expect(done.value).toBeGreaterThan(pending.value)
  })

  it('a pontuação nunca passa de 100', () => {
    const score = calculateMomentum(
      input({
        activities: Array.from({ length: 7 }, (_, index) =>
          activityOn(addDays(TODAY, -index), 600),
        ),
        habits: [HABIT],
        habitLogs: Array.from({ length: 7 }, (_, index) => habitLog(addDays(TODAY, -index))),
        tasks: Array.from({ length: 7 }, (_, index) =>
          taskOn(addDays(TODAY, -index), 'feita', `t${index}`),
        ),
      }),
    )
    expect(score.value).toBeLessThanOrEqual(100)
    expect(score.level).toBe('avancando')
  })
})

describe('recommendationFor', () => {
  it('em dia de baixa energia sugere a versão mínima, nunca compensar', () => {
    const score = calculateMomentum(input({ activities: [activityOn(TODAY)] }))
    const text = recommendationFor(score, CAPACITY_PROFILES.minima)
    expect(text.toLowerCase()).toContain('mínima')
  })

  it('em ritmo alto não empurra mais tarefa, empurra a meta parada', () => {
    const score = calculateMomentum(week())
    expect(score.level).toBe('avancando')
    expect(recommendationFor(score, CAPACITY_PROFILES.plena)).toContain('meta mais parada')
  })
})

describe('dailySeries', () => {
  it('devolve exatamente sete dias terminando hoje', () => {
    const series = dailySeries(input({ activities: [activityOn(TODAY)] }))
    expect(series).toHaveLength(7)
    expect(series[6]?.day).toBe(TODAY)
    expect(series[0]?.day).toBe(addDays(TODAY, -6))
  })

  it('intensidade fica entre zero e um', () => {
    const series = dailySeries(input({ activities: [activityOn(TODAY, 600)] }))
    for (const day of series) {
      expect(day.intensity).toBeGreaterThanOrEqual(0)
      expect(day.intensity).toBeLessThanOrEqual(1)
    }
  })
})


describe('os quatro fatores', () => {
  it('os pesos são os do produto e somam 100 pontos', () => {
    expect(DEFAULT_MOMENTUM_WEIGHTS).toEqual({
      consistency: 0.35,
      priorities: 0.3,
      objectives: 0.2,
      recovery: 0.15,
    })

    const factors = momentumFactors(calculateMomentum(week()))
    expect(factors).toHaveLength(4)
    expect(factors.reduce((sum, factor) => sum + factor.maxPoints, 0)).toBe(100)
  })

  it('cada fator é normalizado entre 0 e 100 antes do peso', () => {
    for (const factor of momentumFactors(calculateMomentum(week()))) {
      expect(factor.score).toBeGreaterThanOrEqual(0)
      expect(factor.score).toBeLessThanOrEqual(100)
      expect(factor.points).toBeLessThanOrEqual(factor.maxPoints)
    }
  })

  it('o valor bruto é a soma ponderada dos quatro, e nada além disso', () => {
    const score = calculateMomentum(week())
    const soma =
      score.parts.consistency * 0.35 +
      score.parts.priorities * 0.3 +
      score.parts.objectives * 0.2 +
      score.parts.recovery * 0.15

    expect(score.rawValue).toBe(Math.round(soma * 100))
    // O exibido só difere do bruto pelo limite diário, nunca por outra conta.
    expect(Math.abs(score.rawValue - score.value)).toBeLessThanOrEqual(
      Math.max(MAX_DAILY_RISE, MAX_DAILY_DROP) * 2,
    )
  })

  it('marca o fator que não tinha o que medir, em vez de zerá-lo', () => {
    // Sem objetivo nenhum: o fator não tem base e acompanha a consistência.
    const score = calculateMomentum(week())

    expect(score.basis.objectives).toBe(false)
    expect(score.parts.objectives).toBe(score.parts.consistency)
  })
})

describe('impacto', () => {
  it('prioridade principal e ação de objetivo valem mais que tarefa comum', () => {
    const comum = createTask({ userId: 'u1', title: 'Comprar pão', day: TODAY }, 'c1')
    const deObjetivo = {
      ...comum,
      objectiveId: 'obj-1',
      priority: 'alta' as const,
    }
    const principal = { ...comum, isMainPriority: true }

    expect(taskImpact(comum)).toBe('baixo')
    expect(taskImpact(deObjetivo)).toBe('alto')
    expect(taskImpact(principal)).toBe('alto')
  })

  it('hábito nunca passa de impacto médio', () => {
    expect(habitImpact(HABIT)).toBe('baixo')
    expect(habitImpact({ ...HABIT, objectiveId: 'obj-1' })).toBe('medio')
  })

  it('uma prioridade concluída rende mais que três tarefas comuns', () => {
    const comuns = calculateMomentum(
      input({
        tasks: [0, 1, 2].map((index) => taskOn(TODAY, 'feita', `t${index}`)),
      }),
    )
    const prioridade = calculateMomentum(
      input({
        tasks: [{ ...taskOn(TODAY, 'feita', 'p1'), isMainPriority: true }],
      }),
    )

    expect(prioridade.value).toBeGreaterThan(comuns.value)
  })

  it('encher o dia de hábitos fáceis não infla o score', () => {
    const muitos = Array.from({ length: 12 }, (_, index) => ({
      ...HABIT,
      id: `h${index}`,
      name: `Hábito ${index}`,
    }))
    const logs = muitos.map((habit) => ({
      id: `l${habit.id}`,
      userId: 'u1',
      habitId: habit.id,
      day: TODAY,
      status: 'feito' as const,
      createdAt: new Date(),
    }))

    const inflado = calculateMomentum(input({ habits: muitos, habitLogs: logs }))
    const dois = calculateMomentum(
      input({ habits: muitos.slice(0, 2), habitLogs: logs.slice(0, 2) }),
    )

    // Do terceiro hábito em diante o dia não rende mais nada.
    expect(inflado.value).toBe(dois.value)
  })
})

describe('janela de 28 dias com a semana recente pesando mais', () => {
  it('a semana atual pesa mais que as três anteriores juntas por dia', () => {
    const recente = calculateMomentum(week(7))
    const antigo = calculateMomentum(
      input({
        habits: [HABIT],
        ...(() => {
          const built = Array.from({ length: 7 }, (_, index) => fullDay(index + 14))
          return {
            activities: built.flatMap((item) => item.activities),
            habitLogs: built.flatMap((item) => item.habitLogs),
            tasks: built.flatMap((item) => item.tasks),
          }
        })(),
      }),
    )

    expect(recente.value).toBeGreaterThan(antigo.value)
  })

  it('falhar um dia reduz pouco, e nunca zera', () => {
    const cheio = calculateMomentum(week(14))
    const comFalha = calculateMomentum(
      input({
        habits: [HABIT],
        ...(() => {
          const built = Array.from({ length: 14 }, (_, index) => fullDay(index)).filter(
            (_, index) => index !== 1,
          )
          return {
            activities: built.flatMap((item) => item.activities),
            habitLogs: built.flatMap((item) => item.habitLogs),
            tasks: built.flatMap((item) => item.tasks),
          }
        })(),
      }),
    )

    expect(comFalha.value).toBeLessThan(cheio.value)
    expect(cheio.value - comFalha.value).toBeLessThan(12)
    expect(comFalha.value).toBeGreaterThan(50)
  })

  it('o horizonte é de 28 dias', () => {
    expect(MOMENTUM_HORIZON_DAYS).toBe(28)
  })
})

describe('conta nova', () => {
  it('sem uma semana de história o score se marca como parcial', () => {
    const score = calculateMomentum(
      input({ activities: [activityOn(TODAY)], tasks: [taskOn(TODAY, 'feita', 't1')] }),
    )

    expect(score.hasEnoughData).toBe(false)
    expect(score.headline.toLowerCase()).toContain('formando')
  })

  it('conta sem nada registrado não recebe pontos de retomada', () => {
    const score = calculateMomentum(input())

    expect(score.value).toBe(0)
    expect(score.parts.recovery).toBe(0)
    expect(score.headline.toLowerCase()).toContain('sem registro')
  })

  it('duas semanas de uso não são medidas contra os dias em que a conta não existia', () => {
    const score = calculateMomentum(week(14))
    expect(score.hasEnoughData).toBe(true)
    expect(score.value).toBeGreaterThan(70)
  })
})

describe('momentumHistory', () => {
  it('devolve um ponto por dia, terminando hoje', () => {
    const history = momentumHistory(week(), 14)

    expect(history).toHaveLength(14)
    expect(history[13]?.day).toBe(TODAY)
    expect(history[0]?.day).toBe(addDays(TODAY, -13))
  })

  it('o último ponto é o score de hoje', () => {
    const data = week()
    const history = momentumHistory(data, 14)

    expect(history[13]?.value).toBe(calculateMomentum(data).value)
  })

  it('todo ponto fica entre 0 e 100', () => {
    for (const point of momentumHistory(week(14), 14)) {
      expect(point.value).toBeGreaterThanOrEqual(0)
      expect(point.value).toBeLessThanOrEqual(100)
    }
  })
})

describe('o que mudou desde a semana passada', () => {
  it('aponta o fator que mais mexeu, em pontos do score', () => {
    // Semana cheia agora, nada antes: os fatores sobem.
    const score = calculateMomentum(week())
    const top = score.drivers[0]

    expect(top).toBeDefined()
    expect(Math.abs(top?.delta ?? 0)).toBeGreaterThan(0)
    expect(score.headline).toContain(top?.label.toLowerCase() ?? '')
  })

  it('sem mudança nenhuma não inventa motivo', () => {
    const parado = calculateMomentum(input())
    expect(parado.drivers).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// a fórmula oficial: cenários
// ---------------------------------------------------------------------------

/** Dias cumpridos nos deslocamentos dados (0 = hoje), e nada nos outros. */
function daysFull(offsets: readonly number[], extra: Partial<MomentumInput> = {}): MomentumInput {
  const built = offsets.map((offset) => fullDay(offset))
  return input({
    habits: [HABIT],
    activities: built.flatMap((item) => item.activities),
    habitLogs: built.flatMap((item) => item.habitLogs),
    tasks: built.flatMap((item) => item.tasks),
    ...extra,
  })
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index)

/** O maior salto entre dois dias seguidos da curva exibida. */
function steepest(data: MomentumInput, days = 28): { rise: number; drop: number } {
  const history = momentumHistory(data, days)
  let rise = 0
  let drop = 0
  for (let index = 1; index < history.length; index += 1) {
    const diff = (history[index]?.value ?? 0) - (history[index - 1]?.value ?? 0)
    rise = Math.max(rise, diff)
    drop = Math.max(drop, -diff)
  }
  return { rise, drop }
}

describe('a fórmula oficial', () => {
  it('está documentada e os pesos somam 100', () => {
    expect(MOMENTUM_FORMULA).toContain('0,35')
    expect(MOMENTUM_FORMULA).toContain('0,30')
    expect(MOMENTUM_FORMULA).toContain('0,20')
    expect(MOMENTUM_FORMULA).toContain('0,15')
    expect(MOMENTUM_RULES.length).toBeGreaterThanOrEqual(7)
    const total = Object.values(DEFAULT_MOMENTUM_WEIGHTS).reduce((sum, w) => sum + w, 0)
    expect(Math.round(total * 100)).toBe(100)
  })

  it('usuário consistente: 28 dias cumpridos chegam perto de 100, avançando', () => {
    const score = calculateMomentum(daysFull(range(0, 27)))

    expect(score.parts.consistency).toBe(1)
    expect(score.parts.priorities).toBe(1)
    expect(score.value).toBeGreaterThanOrEqual(90)
    expect(score.value).toBeLessThanOrEqual(100)
    expect(score.level).toBe('avancando')
    expect(score.hasEnoughData).toBe(true)
  })

  it('usuário com muitas tarefas fáceis: cumpre tudo e mesmo assim fica abaixo de quem executa prioridade', () => {
    const faceis = input({
      tasks: range(0, 27).flatMap((offset) =>
        range(0, 4).map((index) =>
          taskOn(addDays(TODAY, -offset), 'feita', `f${offset}-${index}`),
        ),
      ),
    })
    const comPrioridade = daysFull(range(0, 27))

    const score = calculateMomentum(faceis)
    expect(score.basis.priorities).toBe(true)
    expect(score.parts.priorities).toBeLessThanOrEqual(PRIORITIES_CAP_WITHOUT_PRIORITY)
    expect(score.value).toBeLessThan(calculateMomentum(comPrioridade).value - 10)
  })

  it('objetivo atrasado: plano parado zera o fator de objetivos, e só ele', () => {
    const parado = calculateMomentum(daysFull(range(0, 27), { planGainAt: () => 0 }))
    const andando = calculateMomentum(daysFull(range(0, 27), { planGainAt: () => 0.35 }))

    expect(parado.basis.objectives).toBe(true)
    expect(parado.parts.objectives).toBe(0)
    expect(andando.parts.objectives).toBe(1)
    expect(parado.parts.consistency).toBe(andando.parts.consistency)
    expect(andando.rawValue - parado.rawValue).toBe(20)
  })

  it('descanso planejado: o dia vazio marcado como descanso não conta contra', () => {
    const sunday = dayKeyToDate(TODAY).getDay()
    const workedDays = range(0, 27).filter(
      (offset) => dayKeyToDate(addDays(TODAY, -offset)).getDay() !== sunday,
    )

    const semDescanso = calculateMomentum(daysFull(workedDays))
    const comDescanso = calculateMomentum(daysFull(workedDays, { restWeekdays: [sunday] }))
    const semanaCheia = calculateMomentum(daysFull(range(0, 27), { restWeekdays: [sunday] }))

    expect(comDescanso.parts.consistency).toBe(1)
    expect(comDescanso.value).toBeGreaterThan(semDescanso.value)
    expect(comDescanso.value).toBe(semanaCheia.value)
  })

  it('descanso planejado: mover-se no dia de descanso conta normal, e o limite é de dois dias', () => {
    const tudo = daysFull(range(0, 27))
    const semRegra = calculateMomentum(tudo)
    const comRegra = calculateMomentum({ ...tudo, restWeekdays: [0, 6] })

    expect(comRegra.value).toBe(semRegra.value)
    expect(normalizeRestWeekdays([0, 1, 2, 3])).toHaveLength(MAX_REST_WEEKDAYS)
    expect(normalizeRestWeekdays([9, -1, 2, 2])).toEqual([2])
  })

  it('falha isolada: um dia vazio custa pouco e não zera nada', () => {
    const cheio = calculateMomentum(daysFull(range(0, 27)))
    const falha = calculateMomentum(daysFull(range(0, 27).filter((offset) => offset !== 3)))

    expect(cheio.value - falha.value).toBeLessThan(6)
    expect(falha.value).toBeGreaterThan(80)
    expect(falha.level).toBe('avancando')
  })

  it('abandono prolongado: cai devagar, nunca mais de MAX_DAILY_DROP por dia, e não zera', () => {
    const abandono = daysFull(range(14, 27))
    const score = calculateMomentum(abandono)

    expect(score.value).toBeGreaterThan(0)
    expect(score.value).toBeLessThan(45)
    expect(score.level).toBe('desacelerando')
    expect(steepest(abandono).drop).toBeLessThanOrEqual(MAX_DAILY_DROP)
    // Semana sem nada planejado: a execução das prioridades não tem base.
    expect(score.basis.priorities).toBe(false)
    // A pausa aberta puxa a retomada pra baixo: parar não é neutro.
    expect(score.basis.recovery).toBe(true)
    expect(score.parts.recovery).toBeLessThan(0.3)
  })

  it('retomada rápida: voltar em dois dias devolve a nota cheia de retomada sem apagar a pausa', () => {
    const retomada = daysFull([0, ...range(3, 27)])
    const score = calculateMomentum(retomada)
    const history = momentumHistory(retomada, 3)

    expect(score.basis.recovery).toBe(true)
    expect(score.parts.recovery).toBe(1)
    // A pausa continua na janela: a consistência lembra dela.
    expect(score.parts.consistency).toBeLessThan(1)
    // O dia da volta é o dia em que o bruto sobe, e o exibido nunca cai nele.
    const ontem = calculateMomentum({ ...retomada, today: addDays(TODAY, -1) })
    expect(score.rawValue).toBeGreaterThan(ontem.rawValue)
    expect(history[2]?.value ?? 0).toBeGreaterThanOrEqual(history[1]?.value ?? 0)
  })

  it('retomada lenta vale menos que rápida, e as duas valem mais que não voltar', () => {
    const rapida = calculateMomentum(daysFull([0, ...range(3, 27)]))
    const lenta = calculateMomentum(daysFull([0, ...range(6, 27)]))
    const semVolta = calculateMomentum(daysFull(range(8, 27)))

    expect(rapida.parts.recovery).toBeGreaterThan(lenta.parts.recovery)
    expect(lenta.parts.recovery).toBeGreaterThan(semVolta.parts.recovery)
  })
})

describe('o que cada estado faz com a execução das prioridades', () => {
  const base = daysFull(range(1, 27))
  const yesterday = addDays(TODAY, -1)

  function withTask(status: Task['status'], day = yesterday): number {
    const task = { ...taskOn(day, status, 'x1'), isMainPriority: true }
    return calculateMomentum({ ...base, tasks: [...base.tasks, task] }).parts.priorities
  }

  it('concluída soma; vencida desconta; adiada custa metade; cancelada não pesa', () => {
    const feita = withTask('feita')
    const vencida = withTask('pendente')
    const adiada = withTask('adiada')
    const cancelada = withTask('cancelada')

    expect(feita).toBe(1)
    expect(cancelada).toBe(1)
    expect(vencida).toBeLessThan(1)
    expect(adiada).toBeLessThan(1)
    expect(adiada).toBeGreaterThan(vencida)

    // Metade do peso: a perda da adiada é cerca de metade da perda da vencida.
    const lossOverdue = 1 - vencida
    const lossPostponed = 1 - adiada
    expect(lossPostponed / lossOverdue).toBeGreaterThan(POSTPONED_WEIGHT - 0.1)
    expect(lossPostponed / lossOverdue).toBeLessThan(POSTPONED_WEIGHT + 0.1)
  })

  it('pendente de hoje não pesa: o dia ainda está aberto', () => {
    expect(withTask('pendente', TODAY)).toBe(1)
  })

  it('pendente em dia de descanso não é cobrada', () => {
    const restDay = dayKeyToDate(yesterday).getDay()
    const task = { ...taskOn(yesterday, 'pendente', 'r1'), isMainPriority: true }
    const score = calculateMomentum({
      ...base,
      tasks: [...base.tasks, task],
      restWeekdays: [restDay],
    })
    expect(score.parts.priorities).toBe(1)
  })
})

describe('o número não pula', () => {
  // Conta de um mês com um único registro antigo, e uma semana cheia agora:
  // o bruto dispara, o exibido sobe no ritmo permitido.
  const salto = daysFull([...range(0, 6), 29])

  it('sobe no máximo MAX_DAILY_RISE pontos por dia depois da primeira semana', () => {
    expect(steepest(salto, 10).rise).toBeLessThanOrEqual(MAX_DAILY_RISE)
  })

  it('diz quanto ainda falta absorver, e o histórico é a mesma curva do número', () => {
    const score = calculateMomentum(salto)
    expect(score.rawValue).toBeGreaterThan(score.value)
    expect(score.heldBack).toBe(score.rawValue - score.value)
    expect(heldBackNote(score) ?? '').toContain(`${score.heldBack}`)

    const history = momentumHistory(salto, 14)
    expect(history[13]?.value).toBe(score.value)
  })

  it('cada conclusão sobe o número, e nunca o derruba', () => {
    const antes = calculateMomentum(daysFull(range(1, 27)))
    const depois = calculateMomentum(daysFull(range(0, 27)))
    expect(depois.rawValue).toBeGreaterThanOrEqual(antes.rawValue)
    expect(depois.value).toBeGreaterThanOrEqual(antes.value)
  })

  it('a variação semanal compara o exibido de hoje com o exibido de sete dias atrás', () => {
    const data = daysFull(range(0, 27))
    const score = calculateMomentum(data)
    const history = momentumHistory(data, 8)
    expect(score.delta).toBe((history[7]?.value ?? 0) - (history[0]?.value ?? 0))
  })
})
