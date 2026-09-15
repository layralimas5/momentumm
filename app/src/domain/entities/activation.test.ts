import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_READY_MESSAGE,
  buildActivation,
  DEFAULT_WEEKDAYS,
  FLEXIBLE_DAYS,
  formatDuration,
  LIFE_AREAS,
  readGoalQuantity,
  resolveArea,
  resolveExtraAreas,
  resolveBudget,
  resolveHorizon,
  type ActivationAnswers,
  type ActivationInput,
} from './activation'
import { addDays, parseDayKey } from './day'
import { MAX_OBJECTIVE_DAYS } from './objective'

const TODAY = parseDayKey('2026-09-03')

function answers(overrides: Partial<ActivationAnswers> = {}): ActivationAnswers {
  return {
    area: 'estudos',
    extraAreas: [],
    customArea: '',
    goal: 'Terminar o curso de arquitetura',
    horizon: { kind: 'preset', days: 90 },
    budget: { mode: 'dia', minutes: 60, weekdays: [1, 2, 3, 4, 5] },
    ...overrides,
  }
}

function input(overrides: Partial<ActivationInput> = {}): ActivationInput {
  return { answers: answers(), today: TODAY, existingAxes: ['estudo'], ...overrides }
}

describe('resolveArea', () => {
  it('Estudos reaproveita o eixo de fábrica em vez de criar um parecido', () => {
    const area = resolveArea('estudos', '', ['estudo'])
    expect(area).toMatchObject({ axis: 'estudo', needsAxis: false })
  })

  it('área da vida sem eixo equivalente vira eixo novo', () => {
    const area = resolveArea('financas', '', ['estudo'])
    expect(area).toMatchObject({ label: 'Finanças', axis: 'financas', needsAxis: true })
  })

  it('não recria uma área que a conta já tem', () => {
    expect(resolveArea('saude', '', ['saude']).needsAxis).toBe(false)
  })

  it('reconhece a área pelo sufixo quando o banco prefixou o slug com o dono', () => {
    const area = resolveArea('carreira', '', ['ec19a1b4-carreira'])
    expect(area).toMatchObject({ axis: 'ec19a1b4-carreira', needsAxis: false })
  })

  it('áreas extras saem sem a principal e sem repetição', () => {
    const extras = resolveExtraAreas(['estudos', 'saude', 'saude', 'outro'], 'Violão', ['estudo'], 'estudo')
    expect(extras.map((area) => area.axis)).toEqual(['saude', 'violao'])
    expect(extras.every((area) => area.needsAxis)).toBe(true)
  })

  it('o plano carrega as áreas extras resolvidas', () => {
    const plan = buildActivation(input({ answers: answers({ extraAreas: ['financas', 'estudos'] }) }))
    expect(plan.axis).toBe('estudo')
    expect(plan.extraAxes.map((area) => area.label)).toEqual(['Finanças'])
  })

  it('"Outra" usa o nome escrito pela pessoa', () => {
    const area = resolveArea('outro', '  Aulas de Violão ', [])
    expect(area).toMatchObject({ label: 'Aulas de Violão', axis: 'aulas-de-violao' })
  })

  it('toda área da lista tem exemplo e dica', () => {
    for (const area of LIFE_AREAS) {
      expect(area.hint.length).toBeGreaterThan(5)
      expect(area.example.length).toBeGreaterThan(5)
    }
  })
})

describe('resolveHorizon', () => {
  it('prazo flexível vira uma data de verdade e avisa que foi assumida', () => {
    const horizon = resolveHorizon({ kind: 'flexivel' }, TODAY)
    expect(horizon).toMatchObject({ days: FLEXIBLE_DAYS, assumed: true, error: null })
  })

  it('data definida é respeitada', () => {
    const date = addDays(TODAY, 44)
    expect(resolveHorizon({ kind: 'data', date }, TODAY)).toMatchObject({
      deadline: date,
      days: 45,
      assumed: false,
    })
  })

  it('recusa data curta demais, sem quebrar a tela', () => {
    const horizon = resolveHorizon({ kind: 'data', date: addDays(TODAY, 2) }, TODAY)
    expect(horizon.error).toContain('pelo menos')
    expect(horizon.days).toBeGreaterThanOrEqual(7)
  })

  it('recusa prazo maior que o limite do objetivo', () => {
    const horizon = resolveHorizon({ kind: 'data', date: addDays(TODAY, 500) }, TODAY)
    expect(horizon.error).not.toBeNull()
    expect(horizon.days).toBeLessThanOrEqual(MAX_OBJECTIVE_DAYS)
  })
})

describe('resolveBudget', () => {
  it('horas por dia entram direto', () => {
    const budget = resolveBudget({ mode: 'dia', minutes: 45, weekdays: [1, 3, 5] })
    expect(budget).toMatchObject({ minutesPerDay: 45, daysPerWeek: 3, minutesPerWeek: 135 })
  })

  it('horas por semana são divididas pelos dias disponíveis', () => {
    const budget = resolveBudget({ mode: 'semana', minutes: 120, weekdays: [1, 3, 5, 6] })
    expect(budget.minutesPerDay).toBe(30)
    expect(budget.minutesPerWeek).toBe(120)
  })

  it('sem dias marcados assume segunda a sexta', () => {
    expect(resolveBudget({ mode: 'dia', minutes: 30, weekdays: [] }).weekdays).toEqual(
      DEFAULT_WEEKDAYS,
    )
  })
})

describe('readGoalQuantity', () => {
  it('lê horas e minutos num eixo medido em tempo', () => {
    expect(readGoalQuantity('Estudar 40 horas de curso', 'estudo')).toEqual({
      value: 2400,
      period: 'total',
    })
    expect(readGoalQuantity('Fazer 90 min de prática', 'estudo')?.value).toBe(90)
  })

  it('separa ritmo de total', () => {
    expect(readGoalQuantity('Estudar 30 min por dia', 'estudo')?.period).toBe('dia')
    expect(readGoalQuantity('Estudar 5 horas por semana', 'estudo')?.period).toBe('semana')
  })

  it('não inventa conversão pra unidade que o eixo não mede', () => {
    // "6 livros" não vira página: a espessura do livro dela é chute.
    expect(readGoalQuantity('Ler 6 livros', 'leitura')).toBeNull()
    expect(readGoalQuantity('Correr 10 km', 'treino')).toBeNull()
  })

  it('não confunde palavra com unidade', () => {
    expect(readGoalQuantity('Terminar as 3 disciplinas hoje', 'estudo')).toBeNull()
  })
})

describe('buildActivation — o plano que cabe', () => {
  const plan = buildActivation(input())

  it('devolve a cadeia inteira: objetivo, marcos, ações e primeiro passo', () => {
    expect(plan.objectiveTitle).toBe('Terminar o curso de arquitetura')
    expect(plan.milestones).toHaveLength(3)
    expect(plan.actions.length).toBeGreaterThan(0)
    expect(plan.firstStep?.day).toBe(TODAY)
  })

  it('os marcos somam 100% do objetivo', () => {
    expect(plan.milestones.reduce((total, stage) => total + stage.weight, 0)).toBe(100)
  })

  it('fica pronto pra salvar quando a conta fecha', () => {
    expect(plan.ambition.fits).toBe(true)
    expect(plan.ready).toBe(true)
    expect(plan.remedies).toHaveLength(0)
    expect(plan.ambition.message).toBeNull()
  })

  it('o hábito nasce nos dias que a pessoa marcou', () => {
    expect(plan.plan.habits[0]?.weekdays).toEqual([1, 2, 3, 4, 5])
  })
})

describe('buildActivation — ambição maior que a disponibilidade', () => {
  const apertado = buildActivation(
    input({
      answers: answers({
        budget: { mode: 'semana', minutes: 120, weekdays: [1, 2, 3, 4] },
        horizon: { kind: 'preset', days: 30 },
      }),
    }),
  )

  it('avisa com a frase e os dois números', () => {
    expect(apertado.ambition.fits).toBe(false)
    expect(apertado.ambition.message).toMatch(
      /^Seu plano exige aproximadamente .+, mas sua disponibilidade é de .+\. Vamos reorganizar\?$/,
    )
  })

  it('nunca entrega um plano impossível como pronto', () => {
    expect(apertado.ready).toBe(false)
  })

  it('mostra a base da conta, pra ela ser conferível', () => {
    expect(apertado.ambition.basis).toContain('Por semana')
    expect(apertado.ambition.availableMinutesPerWeek).toBe(120)
  })

  it('oferece saídas concretas, e revisar manualmente é sempre uma delas', () => {
    const keys = apertado.remedies.map((remedy) => remedy.key)
    expect(keys).toContain('manual')
    expect(apertado.remedies.length).toBeGreaterThan(1)
  })

  it('cada saída oferecida realmente resolve', () => {
    for (const remedy of apertado.remedies) {
      if (!remedy.adjustment) continue
      const corrigido = buildActivation({
        ...input({
          answers: answers({
            budget: { mode: 'semana', minutes: 120, weekdays: [1, 2, 3, 4] },
            horizon: { kind: 'preset', days: 30 },
          }),
        }),
        adjustment: remedy.adjustment,
      })
      expect(corrigido.ready).toBe(true)
    }
  })

  it('cada saída diz o número que ela produz', () => {
    for (const remedy of apertado.remedies) {
      expect(remedy.detail.length).toBeGreaterThan(10)
    }
  })
})

describe('buildActivation — o alvo', () => {
  it('usa o número que a pessoa escreveu quando ele existe', () => {
    const plan = buildActivation(
      input({ answers: answers({ goal: 'Estudar 40 horas do curso' }) }),
    )
    expect(plan.target).toBe(2400)
    expect(plan.targetSource).toBe('declarado')
  })

  it('ritmo declarado vira total pelas sessões que o calendário comporta', () => {
    const plan = buildActivation(
      input({
        answers: answers({
          goal: 'Estudar 30 min por dia',
          horizon: { kind: 'preset', days: 28 },
          budget: { mode: 'dia', minutes: 60, weekdays: [1, 2, 3, 4, 5] },
        }),
      }),
    )
    // 4 semanas x 5 dias = 20 sessões de 30 minutos.
    expect(plan.target).toBe(600)
  })

  it('sem número escrito, o alvo sai do ritmo saudável do eixo', () => {
    const plan = buildActivation(input({ answers: answers({ goal: 'Terminar o curso' }) }))
    expect(plan.targetSource).toBe('ritmo')
    expect(plan.target).toBeGreaterThan(0)
  })
})

describe('buildActivation — área nova', () => {
  it('marca que o eixo precisa ser criado ao salvar', () => {
    const plan = buildActivation(
      input({
        answers: answers({ area: 'financas', goal: 'Montar a reserva' }),
        existingAxes: ['estudo'],
      }),
    )

    expect(plan.needsAxis).toBe(true)
    expect(plan.axis).toBe('financas')
    expect(plan.areaLabel).toBe('Finanças')
  })
})

describe('buildActivation — prazo assumido', () => {
  it('diz em voz alta quando a data foi o app que escolheu', () => {
    const plan = buildActivation(
      input({ answers: answers({ horizon: { kind: 'flexivel' } }) }),
    )
    expect(plan.assumedDeadline).toBe(true)
    expect(plan.deadline).toBe(addDays(TODAY, FLEXIBLE_DAYS - 1))
  })
})

describe('formatDuration', () => {
  it('fala em horas e minutos como gente', () => {
    expect(formatDuration(340)).toBe('5h40')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(65)).toBe('1h05')
  })
})

describe('mensagem final', () => {
  it('é a promessa do produto, e ela não muda', () => {
    expect(ACTIVATION_READY_MESSAGE).toBe(
      'Seu plano está pronto. Você não precisa resolver o objetivo inteiro hoje. Seu próximo passo é este.',
    )
  })
})
