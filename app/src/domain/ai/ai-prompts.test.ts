import { describe, expect, it } from 'vitest'
import { SimulatedAiService } from '@/infrastructure/ai/simulated-ai-service'
import { addDays, parseDayKey } from '@/domain/entities/day'
import type { AiUserContext } from './ai-context'
import {
  AI_OUTPUT_SCHEMAS,
  AI_READ_SCHEMAS,
  aiAdjustmentSchema,
  aiEndpointRequestSchema,
  dayPlanSchema,
  planSuggestionSchema,
  progressReadingSchema,
  recoveryPlanSchema,
  renderContext,
  reviewDraftSchema,
  userPromptFor,
} from './ai-prompts'

const TODAY = parseDayKey('2026-09-10')

const context: AiUserContext = {
  today: TODAY,
  momentum: {
    value: 46,
    rawValue: 51,
    level: 'Constante',
    delta: 0,
    hasEnoughData: true,
    factors: [
      { label: 'Consistência recente', score: 60, weightPercent: 35, measured: true },
      { label: 'Execução das prioridades', score: 23, weightPercent: 30, measured: true },
      { label: 'Progresso nos objetivos', score: 45, weightPercent: 20, measured: false },
      { label: 'Capacidade de retomada', score: 60, weightPercent: 15, measured: true },
    ],
    drivers: [{ label: 'Execução das prioridades', delta: -4 }],
    nextAction: {
      title: 'Ler 20 páginas',
      gain: 3,
      reason: 'É o item de maior impacto ainda em aberto. +3 no score hoje, puxado por execução das prioridades.',
    },
  },
  consistency: { activeDaysLast7: 5, activeDaysLast28: 12, streak: 1, streakRecord: 4 },
  capacity: { label: 'Plena', focusMin: 25, actions: 3, checkedIn: false },
  objectives: [
    {
      ref: 'o1',
      title: 'Ler 6 livros',
      axis: 'Leitura',
      motive: null,
      priority: 'alta',
      state: 'Atrasado',
      deadline: addDays(TODAY, 60),
      daysLeft: 60,
      volume: { done: 68, target: 1800, unit: 'páginas' },
      planPercent: 33,
      stages: [
        { title: 'Escolher', weightPercent: 10, status: 'concluida', dueOn: null, tasksDone: 0, tasksTotal: 0 },
        { title: 'Ler os três primeiros', weightPercent: 90, status: 'em-andamento', dueOn: addDays(TODAY, 20), tasksDone: 2, tasksTotal: 4 },
      ],
      currentStage: 'Ler os três primeiros',
      bottleneck: 'Ler os três primeiros',
      nextAction: 'Ler o capítulo 4',
      overdueActions: 1,
      forecast: 'Mantendo esse ritmo, fecha 18 dias antes do prazo.',
      habitCount: 1,
    },
  ],
  routine: [
    { title: 'Almoço', time: '12:00', durationMin: 60, done: false, ofObjective: false },
    { title: 'Treino', time: '18:30', durationMin: 45, done: false, ofObjective: true },
  ],
  habits: [
    {
      ref: 'h1',
      name: 'Ler antes de dormir',
      axis: 'Leitura',
      frequency: 'Todos os dias',
      target: 20,
      minimalTarget: 5,
      unit: 'páginas',
      objective: 'Ler 6 livros',
      consistencyPercent: 36,
      doneLast7: 3,
      scheduledToday: true,
      doneToday: false,
    },
  ],
  todayTasks: [
    {
      ref: 'a1',
      title: 'Treinar 45 minutos',
      day: TODAY,
      estimatedMin: 45,
      priority: 'alta',
      status: 'pendente',
      isMainPriority: true,
      objective: null,
      minimalVersion: 'Fazer 10 minutos',
    },
  ],
  overdueTasks: [
    {
      ref: 'a2',
      title: 'Ler o capítulo 4',
      day: addDays(TODAY, -2),
      estimatedMin: 25,
      priority: 'media',
      status: 'pendente',
      isMainPriority: false,
      objective: 'Ler 6 livros',
      minimalVersion: null,
    },
  ],
  upcomingTasks: [
    {
      ref: 'a3',
      title: 'Ler o capítulo 5',
      day: addDays(TODAY, 2),
      estimatedMin: 25,
      priority: 'media',
      status: 'pendente',
      isMainPriority: false,
      objective: 'Ler 6 livros',
      minimalVersion: null,
    },
  ],
  reviews: [
    {
      week: '31 de ago a 06 de set',
      achievements: null,
      difficulties: 'Semana cheia',
      learnings: null,
      adjustments: 'Ler de manhã',
      priorities: [],
      completed: true,
    },
  ],
  recentWins: ['Abri o livro'],
}

describe('renderContext', () => {
  it('escreve só as seções que existem, com os números que sustentam a leitura', () => {
    const text = renderContext(context)
    expect(text).toContain('Momentumm: 46/100')
    expect(text).toContain('Gargalo: Ler os três primeiros')
    expect(text).toContain('Ajustes decididos: Ler de manhã')
    expect(text).toContain('PRIORIDADE PRINCIPAL')
    expect(text).toContain('sem base')
    expect(text).toContain('AÇÕES ATRASADAS')
    expect(text).toContain('[a2] "Ler o capítulo 4"')
    expect(text).toContain('AÇÕES DOS PRÓXIMOS 7 DIAS')
    expect(text).toContain('[o1]')
    expect(text).toContain('[h1]')
    expect(text).toContain('Momentumm bruto (sem o limite diário): 51/100')
    expect(text).toContain('O que mudou vs semana anterior: Execução das prioridades -4')
    expect(text).toContain('Próxima ação com mais potencial: "Ler 20 páginas" (+3 no score hoje)')
  })

  it('os prompts das portas contextuais carregam o pedido e as regras de ajuste', () => {
    const day = userPromptFor({
      kind: 'day',
      request: { context, availableMin: 60, plannedMin: 110 },
    })
    expect(day).toContain('Tempo disponível hoje: 60 minutos')
    expect(day).toContain('move_action')

    const recovery = userPromptFor({
      kind: 'recovery',
      request: { context, signals: ['3 dias de baixa execução'], daysSinceLastMove: 4 },
    })
    expect(recovery).toContain('sem culpa')
    expect(recovery).toContain('3 dias de baixa execução')

    const draft = userPromptFor({
      kind: 'review_draft',
      request: {
        context,
        weekLabel: '31 de ago a 06 de set',
        executionRate: 0.5,
        habitsDone: 3,
        habitsPlanned: 7,
        tasksDone: 2,
        tasksPlanned: 4,
        activeDays: 4,
        focusMinutes: 90,
        written: { achievements: 'Voltei a ler', difficulties: null, learnings: null, adjustments: null },
      },
    })
    expect(draft).toContain('Ela já escreveu em conquistas: Voltei a ler')
    expect(draft).toContain('primeira pessoa')
  })

  it('o prompt de plano carrega o pedido e o contexto', () => {
    const prompt = userPromptFor({
      kind: 'plan',
      request: {
        context,
        title: 'Aprender violão',
        axis: 'estudo',
        target: 1200,
        unitLabel: 'minutos',
        startedOn: TODAY,
        deadline: addDays(TODAY, 60),
        minutesPerDay: 30,
        motive: null,
        baseline: null,
      },
    })
    expect(prompt).toContain('"Aprender violão"')
    expect(prompt).toContain('30 minutos por dia (teto)')
    expect(prompt).toContain('CONTEXTO DA CONTA')
  })

  it('sem roteiro pro assunto, o prompt manda montar do zero', () => {
    const prompt = userPromptFor({
      kind: 'plan',
      request: {
        context,
        title: 'Aprender violão',
        axis: 'estudo',
        target: 1200,
        unitLabel: 'minutos',
        startedOn: TODAY,
        deadline: addDays(TODAY, 60),
        minutesPerDay: 30,
        motive: null,
        baseline: null,
      },
    })
    expect(prompt).toContain('Não existe roteiro pronto pra esse assunto')
  })

  it('com roteiro, o prompt manda personalizar em vez de reinventar', () => {
    /*
      É a diferença que faz o plano de "emagrecer" não mudar de estrutura a
      cada chamada: em assunto conhecido a IA parte do que a biblioteca sabe e
      gasta o raciocínio no que é desta pessoa.
    */
    const prompt = userPromptFor({
      kind: 'plan',
      request: {
        context,
        title: 'Emagrecer 8kg',
        axis: 'treino',
        target: 1200,
        unitLabel: 'minutos',
        startedOn: TODAY,
        deadline: addDays(TODAY, 90),
        minutesPerDay: 60,
        motive: null,
        baseline: {
          label: 'Plano de emagrecimento',
          steps: [{ title: 'Saber de onde você parte', description: 'Peso, medidas e a semana de hoje.' }],
          habits: ['Treinar', 'Registrar o que comi'],
          tasks: ['Pesar e tirar as fotos do primeiro dia'],
          caution: 'O Momentumm organiza a rotina, não prescreve dieta.',
        },
      },
    })

    expect(prompt).toContain('ROTEIRO BASE ("Plano de emagrecimento"')
    expect(prompt).toContain('mantenha o que serve')
    expect(prompt).toContain('Saber de onde você parte')
    expect(prompt).toContain('Limite a repassar em warnings')
  })

  it('o prompt cobra que o plano faça sentido pro assunto', () => {
    const prompt = userPromptFor({
      kind: 'plan',
      request: {
        context,
        title: 'Emagrecer 8kg',
        axis: 'treino',
        target: 1200,
        unitLabel: 'minutos',
        startedOn: TODAY,
        deadline: addDays(TODAY, 90),
        minutesPerDay: 60,
        motive: null,
        baseline: null,
      },
    })

    // As três regras que mudam o resultado, e a que protege a pessoa.
    expect(prompt).toContain('precisa fazer sentido PRO ASSUNTO')
    expect(prompt).toContain('Ação concreta')
    expect(prompt).toContain('Os pesos dizem onde está o trabalho')
    expect(prompt).toContain('NENHUMA prescrição de saúde')
  })
})

describe('schemas de saída', () => {
  it('aceitam o que a implementação simulada devolve: os dois lados falam o mesmo formato', async () => {
    const simulated = new SimulatedAiService()
    const plan = await simulated.buildPlan({
      context,
      title: 'Aprender violão',
      axis: 'estudo',
      target: 1200,
      unitLabel: 'minutos',
      startedOn: TODAY,
      deadline: addDays(TODAY, 60),
      minutesPerDay: 30,
      motive: null,
      baseline: null,
    })
    expect(planSuggestionSchema.safeParse(plan).success).toBe(true)

    const reading = await simulated.readProgress({
      context,
      momentum: 46,
      momentumLevel: 'constante',
      activeDays: 5,
      windowDays: 7,
      habitRate: 0.8,
      taskRate: 0.25,
      stalledObjectives: [],
      overdueTasks: 1,
      plannedTodayMin: 45,
      capacityMin: 75,
      weakestFactor: 'execução das prioridades',
    })
    expect(progressReadingSchema.safeParse(reading).success).toBe(true)

    const day = await simulated.reorganizeDay({ context, availableMin: 20, plannedMin: 45 })
    expect(dayPlanSchema.safeParse(day).success).toBe(true)
    expect(day.adjustments.length).toBeGreaterThan(0)

    const fits = await simulated.reorganizeDay({ context, availableMin: 90, plannedMin: 45 })
    expect(fits.fits).toBe(true)
    expect(fits.adjustments).toHaveLength(0)

    const draft = await simulated.draftReview({
      context,
      weekLabel: 'semana',
      executionRate: 0.5,
      habitsDone: 3,
      habitsPlanned: 7,
      tasksDone: 2,
      tasksPlanned: 4,
      activeDays: 4,
      focusMinutes: 90,
      written: { achievements: 'Voltei a ler', difficulties: null, learnings: null, adjustments: null },
    })
    expect(reviewDraftSchema.safeParse(draft).success).toBe(true)
    // O que a pessoa escreveu é preservado, nunca substituído.
    expect(draft.achievements).toBe('Voltei a ler')

    const recovery = await simulated.planRecovery({
      context,
      signals: ['3 dias de baixa execução'],
      daysSinceLastMove: 4,
    })
    expect(recoveryPlanSchema.safeParse(recovery).success).toBe(true)
    expect(recovery.adjustments.length).toBeLessThanOrEqual(3)
  })

  it('ajuste exige ref no formato do contexto e motivo', () => {
    expect(aiAdjustmentSchema.safeParse({ type: 'move_action', ref: 'a1', toDay: '2026-09-11', reason: 'x' }).success).toBe(true)
    expect(aiAdjustmentSchema.safeParse({ type: 'move_action', ref: 'uuid-1', toDay: '2026-09-11', reason: 'x' }).success).toBe(false)
    expect(aiAdjustmentSchema.safeParse({ type: 'shrink_action', ref: 'a1' }).success).toBe(false)
    expect(aiAdjustmentSchema.safeParse({ type: 'delete_everything', ref: 'a1', reason: 'x' }).success).toBe(false)
  })

  it('recusa ícone e etapa fora do domínio', () => {
    const result = planSuggestionSchema.safeParse({
      steps: ['a', 'b'],
      habits: [{ name: 'x', icon: 'foguete', frequency: 'diario', weekdays: [], timesPerWeek: 7, dayPart: 'manha', target: 1, minimalTarget: 1, rationale: 'r' }],
      tasks: [{ title: 't', description: null, day: '2026-09-10', estimatedMin: 10, effort: 'leve', priority: 'alta', minimalVersion: null, order: 0, stepIndex: 0 }],
      suggestedDeadline: '2026-10-10',
      reasoning: 'r',
      warnings: [],
    })
    expect(result.success).toBe(false)
  })

  it('o pedido ao endpoint exige kind válido e contexto com data', () => {
    expect(aiEndpointRequestSchema.safeParse({ kind: 'plan', request: { context } }).success).toBe(true)
    expect(aiEndpointRequestSchema.safeParse({ kind: 'chat', request: { context } }).success).toBe(false)
    expect(aiEndpointRequestSchema.safeParse({ kind: 'plan', request: {} }).success).toBe(false)
  })
})

describe('o cliente novo contra o servidor antigo', () => {
  /*
    O app e a Edge Function sobem SEPARADOS, e entre um e outro existe uma
    janela em que o cliente novo conversa com o servidor velho. Aconteceu de
    verdade: o front foi publicado antes do `ai:deploy`, o servidor continuou
    mandando `steps: string[]`, e o cliente recusava a resposta inteira.

    Pedir o formato novo e aceitar os dois é a única postura que sobrevive a
    isso, e é o que estes testes cobram.
  */
  const RESPOSTA_ANTIGA = {
    steps: ['Entrar no ritmo', 'Chegar na metade', 'Fechar o objetivo'],
    habits: [],
    tasks: [
      {
        title: 'Fazer a primeira sessão',
        description: null,
        day: TODAY,
        estimatedMin: 30,
        effort: 'medio' as const,
        priority: 'alta' as const,
        minimalVersion: null,
        order: 0,
        stepIndex: 0,
      },
    ],
    suggestedDeadline: addDays(TODAY, 60),
    reasoning: 'Dividi o alvo pelas semanas.',
    warnings: [],
  }

  it('a leitura aceita a etapa como string e devolve etapa inteira', () => {
    const parsed = AI_READ_SCHEMAS.plan.safeParse(RESPOSTA_ANTIGA)

    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    expect(parsed.data.steps).toHaveLength(3)
    expect(parsed.data.steps[0]?.title).toBe('Entrar no ritmo')
    // Sem descrição, o título vira a própria explicação: é o que havia.
    expect(parsed.data.steps[0]?.description).toBe('Entrar no ritmo')
    expect(parsed.data.steps[0]?.weight).toBe(0)
  })

  it('e continua aceitando o formato novo, sem ambiguidade', () => {
    const nova = {
      ...RESPOSTA_ANTIGA,
      steps: [
        { title: 'Saber de onde você parte', description: 'Peso e medidas.', weight: 15 },
        { title: 'Fazer a semana existir', description: 'Os treinos acontecendo.', weight: 45 },
        { title: 'Sustentar', description: 'Manter por semanas.', weight: 40 },
      ],
    }

    const parsed = AI_READ_SCHEMAS.plan.safeParse(nova)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    expect(parsed.data.steps[1]?.weight).toBe(45)
    expect(parsed.data.steps[1]?.description).toBe('Os treinos acontecendo.')
  })

  it('o que o app PEDE continua estrito: string não passa', () => {
    // O schema de saída vira JSON Schema pra o modelo. União ali faria ele
    // escolher o formato mais fácil, que é justamente o que saiu de cena.
    expect(AI_OUTPUT_SCHEMAS.plan.safeParse(RESPOSTA_ANTIGA).success).toBe(false)
  })
})
