import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, parseDayKey } from './day'
import { TOTAL_WEIGHT } from './plan-stage'
import { MAX_OBJECTIVE_DAYS } from './objective'
import {
  buildCombinedPlan,
  buildPlan,
  suggestedTarget,
  type ObjectiveSeed,
  type PlanInput,
} from './plan-builder'

const TODAY = parseDayKey('2026-08-13')

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    axis: 'leitura',
    title: 'Ler 6 livros',
    target: 600,
    today: TODAY,
    deadline: addDays(TODAY, 59),
    daysPerWeek: 5,
    minutesPerDay: 60,
    ...overrides,
  }
}

describe('buildPlan', () => {
  it('área criada pela pessoa gera ações e hábito a partir do objetivo escrito', () => {
    const plan = buildPlan(
      input({ axis: 'carreira', axisLabel: 'Carreira', title: 'Ter 30 leads do Momentumm', target: 600 }),
    )
    expect(plan.habits[0]?.name).toBe('Trabalhar pra ter 30 leads do Momentumm')
    expect(plan.tasks.map((task) => task.title)).toContain('Dar o primeiro passo pra ter 30 leads do Momentumm')
    expect(plan.tasks.map((task) => task.title)).toContain('Listar o que falta pra ter 30 leads do Momentumm')
  })

  it('sem objetivo em palavras, a área criada usa o próprio nome', () => {
    const plan = buildPlan(input({ axis: 'carreira', axisLabel: 'Carreira', title: 'Carreira: primeiro passo' }))
    expect(plan.habits[0]?.name).toBe('Dedicar tempo a carreira')
  })

  it('divide o alvo pelas sessões que cabem no prazo', () => {
    // 60 dias com 5 dias por semana dá 42 sessões; 600 páginas em 42 sessões.
    const plan = buildPlan(input())
    expect(plan.totalSessions).toBe(42)
    expect(plan.perSession).toBe(Math.ceil(600 / 42))
  })

  it('é determinístico: mesma entrada, mesmo plano', () => {
    expect(buildPlan(input())).toEqual(buildPlan(input()))
  })

  it('a primeira ação cai hoje e nasce como prioridade principal', () => {
    const [first] = buildPlan(input()).tasks
    expect(first?.day).toBe(TODAY)
    expect(first?.isMainPriority).toBe(true)
  })

  it('só existe uma prioridade principal no plano', () => {
    const main = buildPlan(input()).tasks.filter((task) => task.isMainPriority)
    expect(main).toHaveLength(1)
  })

  it('o hábito vem com versão mínima menor que o alvo', () => {
    const [habit] = buildPlan(input()).habits
    expect(habit?.minimalTarget).toBeGreaterThan(0)
    expect(habit?.minimalTarget).toBeLessThanOrEqual(habit?.target ?? 0)
  })

  it('cinco dias por semana viram os dias úteis', () => {
    const [habit] = buildPlan(input({ daysPerWeek: 5 })).habits
    expect(habit?.weekdays).toEqual([1, 2, 3, 4, 5])
  })

  it('todo dia é representado por lista vazia, como o hábito já faz', () => {
    const [habit] = buildPlan(input({ daysPerWeek: 7 })).habits
    expect(habit?.weekdays).toEqual([])
  })

  it('plano folgado não gera aviso', () => {
    const plan = buildPlan(input({ target: 300 }))
    expect(plan.feasibility).toBe('confortavel')
    expect(plan.warning).toBeNull()
    expect(plan.suggestedDeadline).toBeNull()
  })

  it('plano impossível avisa e sugere um prazo que cabe', () => {
    const plan = buildPlan(input({ target: 1500, deadline: addDays(TODAY, 29) }))
    expect(plan.feasibility).toBe('irreal')
    expect(plan.warning).toContain('prazo')
    expect(plan.suggestedDeadline).not.toBeNull()
  })

  it('o prazo sugerido devolve o plano pro tamanho confortável', () => {
    const impossible = buildPlan(input({ target: 1500, deadline: addDays(TODAY, 29) }))
    const fixed = buildPlan(input({ target: 1500, deadline: impossible.suggestedDeadline ?? TODAY }))
    expect(fixed.feasibility).not.toBe('irreal')
  })

  it('o ritmo semanal cobre o alvo dentro do prazo', () => {
    const plan = buildPlan(input())
    const weeks = 60 / 7
    expect(plan.goal.target * weeks).toBeGreaterThanOrEqual(600)
  })

  it('eixo medido em minutos estima a ação pelo próprio tempo', () => {
    const plan = buildPlan(input({ axis: 'treino', target: 900, daysPerWeek: 3 }))
    const [first] = plan.tasks
    expect(first?.estimatedMin).toBe(plan.perSession)
  })

  it('o tempo declarado é teto: não pede mais do que a pessoa disse que tem', () => {
    // 15 min/dia em leitura cabem ~10 páginas por sessão; 600 páginas não cabem.
    const plan = buildPlan(input({ minutesPerDay: 15 }))
    expect(plan.feasibility).toBe('irreal')
    expect(plan.warning).toContain('15')
    expect(plan.suggestedDeadline).not.toBeNull()
  })

  it('o aviso de tempo diz que o teto foi o tempo, não o eixo', () => {
    const plan = buildPlan(input({ minutesPerDay: 15 }))
    expect(plan.warning).toContain('Não cabe')
  })

  it('mais tempo por dia devolve o mesmo alvo pro confortável', () => {
    const apertado = buildPlan(input({ target: 900, minutesPerDay: 15 }))
    const folgado = buildPlan(input({ target: 900, minutesPerDay: 90 }))
    expect(apertado.feasibility).toBe('irreal')
    expect(folgado.feasibility).not.toBe('irreal')
  })

  it('registra os minutos por sessão junto com o alvo', () => {
    const plan = buildPlan(input({ axis: 'estudo', target: 900, daysPerWeek: 3 }))
    expect(plan.minutesPerSession).toBe(plan.perSession)
    expect(plan.minutesPerDay).toBe(60)
  })

  it('não oferece prazo que o objetivo recusaria', () => {
    // Alvo absurdo pro tempo: a data sustentável passaria de um ano.
    const plan = buildPlan(input({ target: 3000, minutesPerDay: 15 }))
    expect(plan.feasibility).toBe('irreal')
    expect(plan.suggestedDeadline).toBeNull()
    expect(plan.warning).toContain('Nem o prazo máximo resolve')
  })

  it('o prazo sugerido, quando existe, cabe no limite do objetivo', () => {
    const plan = buildPlan(input({ target: 900, minutesPerDay: 15 }))
    if (plan.suggestedDeadline) {
      expect(daysBetween(TODAY, plan.suggestedDeadline) + 1).toBeLessThanOrEqual(MAX_OBJECTIVE_DAYS)
    }
  })

  it('o alvo que cabe gera um plano confortável sem mexer no prazo', () => {
    const apertado = buildPlan(input({ target: 3000, minutesPerDay: 15 }))
    const ajustado = buildPlan(input({ target: apertado.fittingTarget, minutesPerDay: 15 }))
    expect(ajustado.feasibility).toBe('confortavel')
  })

  it('frequência fora da faixa é normalizada em vez de quebrar', () => {
    expect(() => buildPlan(input({ daysPerWeek: 0 }))).not.toThrow()
    expect(buildPlan(input({ daysPerWeek: 99 })).sessionsPerWeek).toBe(7)
  })
})

describe('suggestedTarget', () => {
  it('cresce com o prazo', () => {
    expect(suggestedTarget('leitura', 90, 60, 5)).toBeGreaterThan(
      suggestedTarget('leitura', 30, 60, 5),
    )
  })

  it('cresce com o tempo declarado', () => {
    expect(suggestedTarget('estudo', 60, 60, 5)).toBeGreaterThan(
      suggestedTarget('estudo', 60, 15, 5),
    )
  })

  it('nunca sugere zero', () => {
    expect(suggestedTarget('meditacao', 7, 5, 3)).toBeGreaterThan(0)
  })

  it('o alvo sugerido gera sempre um plano que cabe', () => {
    const target = suggestedTarget('leitura', 60, 30, 4)
    const plan = buildPlan(
      input({ target, deadline: addDays(TODAY, 59), minutesPerDay: 30, daysPerWeek: 4 }),
    )
    expect(plan.feasibility).toBe('confortavel')
  })
})

describe('buildCombinedPlan', () => {
  function seed(overrides: Partial<ObjectiveSeed> = {}): ObjectiveSeed {
    return {
      axis: 'leitura',
      title: 'Ler mais',
      target: 300,
      deadline: addDays(TODAY, 59),
      ...overrides,
    }
  }

  it('divide o tempo do dia igualmente entre os objetivos', () => {
    const combined = buildCombinedPlan({
      seeds: [seed(), seed({ axis: 'treino', title: 'Treinar', target: 900 })],
      today: TODAY,
      daysPerWeek: 5,
      minutesPerDay: 60,
    })

    expect(combined.plans).toHaveLength(2)
    for (const plan of combined.plans) {
      expect(plan.minutesPerDay).toBe(30)
    }
  })

  it('um objetivo folgado cabe', () => {
    const combined = buildCombinedPlan({
      seeds: [seed({ target: 200 })],
      today: TODAY,
      daysPerWeek: 5,
      minutesPerDay: 60,
    })
    expect(combined.fits).toBe(true)
  })

  it('soma o que os planos pedem e avisa quando o dia não estica', () => {
    const combined = buildCombinedPlan({
      seeds: [
        seed({ target: 1200 }),
        seed({ axis: 'treino', title: 'Treinar', target: 3000 }),
        seed({ axis: 'estudo', title: 'Estudar', target: 3000 }),
      ],
      today: TODAY,
      daysPerWeek: 5,
      minutesPerDay: 30,
    })

    expect(combined.fits).toBe(false)
    expect(combined.requiredMinutesPerDay).toBeGreaterThan(combined.minutesPerDay)
    expect(combined.verdict).toContain('o dia não estica')
  })

  it('não acusa estouro que é só arredondamento', () => {
    // Duas sessões de ~23 min num dia de 45: cada plano cabe, e o conjunto
    // também. O 1 minuto de diferença é a conta quebrada, não carga real.
    const combined = buildCombinedPlan({
      seeds: [seed({ target: 630 }), seed({ axis: 'treino', title: 'Treinar', target: 800 })],
      today: TODAY,
      daysPerWeek: 5,
      minutesPerDay: 45,
    })

    for (const plan of combined.plans) {
      expect(plan.feasibility).not.toBe('irreal')
    }
    expect(combined.fits).toBe(true)
  })

  it('nunca passa do teto de objetivos de uma vez', () => {
    const combined = buildCombinedPlan({
      seeds: [
        seed(),
        seed({ axis: 'treino' }),
        seed({ axis: 'estudo' }),
        seed({ axis: 'meditacao' }),
        seed({ axis: 'leitura' }),
      ],
      today: TODAY,
      daysPerWeek: 5,
      minutesPerDay: 60,
    })
    expect(combined.plans).toHaveLength(4)
  })

  it('sem objetivo não há plano, e o veredito diz isso', () => {
    const combined = buildCombinedPlan({
      seeds: [],
      today: TODAY,
      daysPerWeek: 5,
      minutesPerDay: 60,
    })
    expect(combined.plans).toHaveLength(0)
    expect(combined.verdict).toContain('pelo menos uma área')
  })
})

describe('o plano nasce com caminho, não com lista', () => {
  /*
    O objetivo criado sem etapa é um objetivo que o app não consegue explicar:
    a barra passa a medir volume registrado, não existe gargalo, a previsão se
    cala e todas as regras de insight que leem etapa ficam de fora. Era o que
    acontecia com todo objetivo criado fora da IA.
  */
  it('gera etapas e elas somam 100%', () => {
    const plan = buildPlan(input())

    expect(plan.stages.length).toBeGreaterThanOrEqual(3)
    expect(plan.stages.reduce((sum, stage) => sum + stage.weight, 0)).toBe(TOTAL_WEIGHT)
  })

  it('toda ação nasce dentro de uma etapa que existe', () => {
    const plan = buildPlan(input())

    for (const task of plan.tasks) {
      expect(task.stageIndex).not.toBeNull()
      expect(plan.stages[task.stageIndex ?? -1]).toBeDefined()
    }
  })

  it('a última etapa fecha no prazo do objetivo e nenhuma passa dele', () => {
    const plan = buildPlan(input())
    const last = plan.stages[plan.stages.length - 1]

    expect(last?.dueOn).toBe(plan.objective.deadline)
    for (const stage of plan.stages) {
      expect(daysBetween(stage.dueOn, plan.objective.deadline)).toBeGreaterThanOrEqual(0)
    }
  })

  it('as datas das etapas andam pra frente, na ordem do caminho', () => {
    const days = buildPlan(input()).stages.map((stage) => stage.dueOn)

    for (let index = 1; index < days.length; index += 1) {
      expect(daysBetween(days[index - 1] ?? TODAY, days[index] ?? TODAY)).toBeGreaterThan(0)
    }
  })

  it('a conferência de ritmo cai na etapa do meio, não na de entrada', () => {
    const plan = buildPlan(input())
    const checkpoint = plan.tasks[plan.tasks.length - 1]

    expect(checkpoint?.stageIndex).toBe(1)
  })
})
