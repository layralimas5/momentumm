import { describe, expect, it } from 'vitest'
import { SimulatedAiService } from '@/infrastructure/ai/simulated-ai-service'
import { addDays, parseDayKey } from '@/domain/entities/day'
import type { AiUserContext } from './ai-context'
import {
  aiEndpointRequestSchema,
  planSuggestionSchema,
  progressReadingSchema,
  renderContext,
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
  habits: [
    {
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
  overdueTasks: [],
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
    expect(text).toContain('Momentum: 46/100')
    expect(text).toContain('Gargalo: Ler os três primeiros')
    expect(text).toContain('Ajustes decididos: Ler de manhã')
    expect(text).toContain('PRIORIDADE PRINCIPAL')
    expect(text).toContain('sem base')
    expect(text).toContain('Momentum bruto (sem o limite diário): 51/100')
    expect(text).toContain('O que mudou vs semana anterior: Execução das prioridades -4')
    expect(text).toContain('Próxima ação com mais potencial: "Ler 20 páginas" (+3 no score hoje)')
    expect(text).not.toContain('AÇÕES ATRASADAS')
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
      },
    })
    expect(prompt).toContain('"Aprender violão"')
    expect(prompt).toContain('30 minutos por dia (teto)')
    expect(prompt).toContain('CONTEXTO DA CONTA')
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
