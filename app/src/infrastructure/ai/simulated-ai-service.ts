import type {
  AiAdjustment,
  AiDayPlan,
  AiDayRequest,
  AiHabitSuggestion,
  AiPlanRequest,
  AiPlanSuggestion,
  AiProgressReading,
  AiProgressRequest,
  AiQuota,
  AiRecoveryPlan,
  AiRecoveryRequest,
  AiReviewDraft,
  AiReviewDraftRequest,
  AiReviewRequest,
  AiService,
  AiTaskSuggestion,
} from '@/domain/ai/ai-service'
import type { AiContextTask, AiUserContext } from '@/domain/ai/ai-context'
import { addDays, daysBetween, type DayKey } from '@/domain/entities/day'

/**
 * Momentumm AI — implementação SIMULADA.
 *
 * Isto NÃO é IA. É aritmética determinística vestida com a mesma interface, e
 * existe por dois motivos: a tela precisa de algo pra desenhar antes de existir
 * um endpoint, e o formato do que a IA real vai devolver precisa estar fechado
 * antes de alguém escrever o prompt.
 *
 * `simulated: true` é lido pela apresentação e vira um aviso visível. A regra é
 * dura: o app nunca apresenta como leitura de IA algo que saiu daqui.
 *
 * Quando a integração real entrar, ela vai ser outro arquivo implementando a
 * mesma porta e falando com um endpoint no servidor. Chave de LLM não passa
 * pelo frontend — qualquer `VITE_` é público no bundle.
 */

/** Atraso artificial: sem ele a tela nunca exercita o estado de carregando. */
const FAKE_LATENCY_MS = 700

function wait<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), FAKE_LATENCY_MS))
}

export class SimulatedAiService implements AiService {
  readonly simulated = true
  readonly quota: AiQuota | null = null

  async buildPlan(request: AiPlanRequest): Promise<AiPlanSuggestion> {
    const totalDays = Math.max(1, daysBetween(request.startedOn, request.deadline) + 1)
    const weeks = Math.max(1, Math.round(totalDays / 7))
    const perDay = Math.max(1, Math.ceil(request.target / totalDays))

    // O teto do dia manda. Se o alvo não cabe no tempo declarado, o plano
    // avisa em vez de propor um número que a pessoa já sabe que não vai fazer.
    const fitsInDay = perDay <= request.minutesPerDay * unitPerMinute(request.unitLabel)
    const warnings: string[] = []
    if (!fitsInDay) {
      warnings.push(
        `Nesse prazo o ritmo é de ${perDay} ${request.unitLabel} por dia, e você disse ter ${request.minutesPerDay} minutos. Ou o prazo estica, ou o alvo desce.`,
      )
    }
    if (totalDays < 14) {
      warnings.push('Menos de duas semanas dá pouco espaço pra ajustar quando algo der errado.')
    }

    const steps = buildSteps(request, weeks)
    const habits = buildHabits(request, perDay)
    const tasks = buildTasks(request, steps)

    return wait({
      steps,
      habits,
      tasks,
      suggestedDeadline: fitsInDay
        ? request.deadline
        : addDays(request.startedOn, Math.ceil(totalDays * 1.5)),
      reasoning: `Dividi ${request.target} ${request.unitLabel} em ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}, o que dá ${perDay} ${request.unitLabel} por dia. O hábito carrega o volume e as ações cuidam do que não se repete.`,
      warnings,
    })
  }

  async readProgress(request: AiProgressRequest): Promise<AiProgressReading> {
    const patterns: string[] = []
    const bottlenecks: string[] = []
    const adjustments: string[] = []

    patterns.push(
      `Você se moveu em ${request.activeDays} dos últimos ${request.windowDays} dias.`,
    )

    if (request.habitRate >= 0.7 && request.taskRate < 0.5) {
      patterns.push(
        `Os hábitos saem (${percent(request.habitRate)}) e as ações não (${percent(request.taskRate)}): o que se repete sozinho funciona, o que exige decisão trava.`,
      )
      adjustments.push('Reduz pra uma ação por dia e escolhe ela na noite anterior.')
    } else if (request.taskRate >= 0.7 && request.habitRate < 0.5) {
      patterns.push('Você entrega as ações mas não sustenta os hábitos.')
      adjustments.push('Encolhe a meta dos hábitos até o tamanho que você faz num dia ruim.')
    }

    if (request.overdueTasks > 0) {
      bottlenecks.push(
        `${request.overdueTasks} ${request.overdueTasks === 1 ? 'ação atrasada' : 'ações atrasadas'} no plano.`,
      )
      adjustments.push('Remarca ou cancela o que está atrasado antes de planejar coisa nova.')
    }

    if (request.weakestFactor) {
      bottlenecks.push(`O fator que mais derruba teu momentum é ${request.weakestFactor}.`)
    }

    // O último review é a única parte do contexto que a simulação consegue
    // usar sem inventar: é texto da própria pessoa, devolvido como lembrete.
    const lastAdjustment = request.context.reviews.find((review) => review.adjustments)
    if (lastAdjustment?.adjustments) {
      patterns.push(
        `No review de ${lastAdjustment.week} você decidiu: "${lastAdjustment.adjustments}".`,
      )
    }

    const overload =
      request.plannedTodayMin > request.capacityMin
        ? `Hoje o plano pede ${request.plannedTodayMin} minutos e a tua capacidade de hoje é ${request.capacityMin}.`
        : null

    if (overload) adjustments.push('Tira do dia o que não muda nada se sair amanhã.')

    // Propostas aplicáveis: o que a aritmética consegue sustentar sem inventar.
    const proposals: AiAdjustment[] = []
    const overdue = request.context.overdueTasks[0]
    if (overdue) {
      proposals.push({
        type: 'move_action',
        ref: overdue.ref,
        toDay: addDays(request.context.today, 1),
        reason: `"${overdue.title}" era pra ${overdue.day} e continua pendente: remarcar tira ela da lista de atrasadas.`,
      })
    }
    const shrinkable = request.context.todayTasks.find((task) => task.minimalVersion && task.status === 'pendente')
    if (overload && shrinkable) {
      proposals.push({
        type: 'shrink_action',
        ref: shrinkable.ref,
        reason: `O dia pede ${request.plannedTodayMin} min e cabe ${request.capacityMin}: a versão mínima de "${shrinkable.title}" preserva o movimento.`,
      })
    }

    return wait({
      summary: summaryOf(request),
      patterns,
      bottlenecks,
      overload,
      stalled: request.stalledObjectives,
      adjustments: adjustments.length > 0 ? adjustments : ['Segue como está. O ritmo está sustentável.'],
      nextAction: nextActionOf(request),
      proposals,
    })
  }

  async reorganizeDay(request: AiDayRequest): Promise<AiDayPlan> {
    const { context } = request
    const pending = context.todayTasks.filter((task) => task.status === 'pendente' || task.status === 'em-andamento')
    const over = request.plannedMin - request.availableMin

    if (over <= 0) {
      return wait({
        summary: `O dia pede ${request.plannedMin} minutos e você tem ${request.availableMin}: cabe como está.`,
        fits: true,
        adjustments: [],
        reasoning: 'Nada a mexer quando o planejado já cabe no tempo declarado.',
      })
    }

    // A ordem de sacrifício: encolher primeiro quem tem versão mínima, depois
    // empurrar as ações comuns pra amanhã, da menor prioridade pra maior. A
    // prioridade principal não sai do dia.
    const adjustments: AiAdjustment[] = []
    let saved = 0
    for (const task of pending) {
      if (saved >= over) break
      if (task.minimalVersion) {
        adjustments.push({
          type: 'shrink_action',
          ref: task.ref,
          reason: `"${task.title}" tem versão mínima escrita: encolher mantém o movimento e libera parte dos ${task.estimatedMin} min.`,
        })
        saved += Math.round(task.estimatedMin / 2)
      }
    }
    for (const task of [...pending].sort((a, b) => priorityRank(a) - priorityRank(b))) {
      if (saved >= over) break
      if (task.isMainPriority || adjustments.some((item) => 'ref' in item && item.ref === task.ref)) continue
      adjustments.push({
        type: 'move_action',
        ref: task.ref,
        toDay: firstFreeDay(context),
        reason: `"${task.title}" (${task.estimatedMin} min, prioridade ${task.priority}) é o que menos perde saindo de hoje.`,
      })
      saved += task.estimatedMin
    }

    return wait({
      summary: `O dia pede ${request.plannedMin} minutos e você tem ${request.availableMin}: faltam ${over}.`,
      fits: saved >= over,
      adjustments,
      reasoning: 'Encolhi o que tem versão mínima e empurrei as ações de menor prioridade, mantendo a principal no dia.',
    })
  }

  async draftReview(request: AiReviewDraftRequest): Promise<AiReviewDraft> {
    const { written, context } = request
    const execution = percent(request.executionRate)
    const late = context.objectives.filter((objective) => objective.overdueActions > 0)
    const bottleneck = context.objectives.find((objective) => objective.bottleneck)

    const achievements =
      written.achievements ??
      `Fechei ${request.tasksDone} de ${request.tasksPlanned} ações e ${request.habitsDone} de ${request.habitsPlanned} hábitos, em ${request.activeDays} dias ativos.`
    const difficulties =
      written.difficulties ??
      (context.overdueTasks.length > 0
        ? `${context.overdueTasks.length} ${context.overdueTasks.length === 1 ? 'ação ficou' : 'ações ficaram'} pra trás, a mais antiga de ${context.overdueTasks[0]?.day ?? ''}.`
        : `A execução ficou em ${execution}; o que não saiu foi por falta de dia, não de plano.`)
    const learnings =
      written.learnings ??
      (request.habitsDone >= request.tasksDone
        ? 'O que se repete sozinho saiu mais do que o que exige decisão.'
        : 'As ações saíram mais do que os hábitos: decisão pontual funciona melhor que rotina agora.')
    const adjustments =
      written.adjustments ??
      (bottleneck
        ? `Concentrar a semana na etapa "${bottleneck.bottleneck}" de "${bottleneck.title}", que está segurando o resto.`
        : 'Manter o tamanho da semana e trazer só uma ação por dia.')

    const priorities = context.objectives
      .map((objective) => objective.nextAction)
      .filter((item): item is string => item !== null)
      .slice(0, 3)

    return wait({
      achievements,
      difficulties,
      learnings,
      adjustments,
      priorities: priorities.length > 0 ? priorities : ['Escolher a próxima ação de cada objetivo'],
      basis: `Execução ${execution}, ${request.activeDays} dias ativos, ${context.overdueTasks.length} atrasadas${late.length > 0 ? `, ${late.length} objetivo(s) com atraso` : ''}.`,
    })
  }

  async planRecovery(request: AiRecoveryRequest): Promise<AiRecoveryPlan> {
    const { context } = request
    const candidates = [...context.overdueTasks, ...context.todayTasks.filter((task) => task.status === 'pendente')]
      .sort((a, b) => a.estimatedMin - b.estimatedMin)
    const adjustments: AiAdjustment[] = []
    const objectivesUsed = new Set<string | null>()

    for (const task of candidates) {
      if (adjustments.length >= 3) break
      if (objectivesUsed.has(task.objective)) continue
      objectivesUsed.add(task.objective)
      if (task.day < context.today) {
        adjustments.push({
          type: 'move_action',
          ref: task.ref,
          toDay: context.today,
          reason: `${task.estimatedMin} min: o menor passo pendente de "${task.objective ?? 'caixa de entrada'}".`,
        })
      } else if (task.minimalVersion) {
        adjustments.push({
          type: 'shrink_action',
          ref: task.ref,
          reason: `A versão mínima de "${task.title}" é o degrau em que dá pra voltar hoje.`,
        })
      }
    }

    if (adjustments.length === 0) {
      const objective = context.objectives[0]
      adjustments.push({
        type: 'create_action',
        title: objective ? `Dez minutos em "${objective.title}"` : 'Dez minutos no que estava parado',
        day: context.today,
        estimatedMin: 10,
        minimalVersion: 'Cinco minutos',
        objectiveRef: objective?.ref ?? null,
        reason: 'Não há ação pequena pendente: um passo de dez minutos reabre o dia sem pedir o plano inteiro.',
      })
    }

    const keepHabits = [...context.habits]
      .sort((a, b) => b.consistencyPercent - a.consistencyPercent)
      .slice(0, 2)
      .map((habit) => habit.ref)

    return wait({
      opening: `A sequência recorde de ${context.consistency.streakRecord} dias continua tua. ${context.objectives.filter((objective) => (objective.planPercent ?? 0) > 0).length > 0 ? 'O que já andou nos objetivos não voltou atrás.' : 'O plano continua onde você deixou.'} Voltar em passos pequenos é o que o fator de retomada mede.`,
      adjustments,
      keepHabits,
      reasoning: 'Passos ordenados por avanço por minuto: o menor primeiro, porque é o que tem mais chance de sair hoje.',
    })
  }

  async summarizeReview(request: AiReviewRequest): Promise<string> {
    const execution = percent(request.executionRate)
    const parts = [
      `Na semana de ${request.weekLabel} você executou ${execution} do planejado, com ${request.habitsDone} hábitos cumpridos em ${request.activeDays} dias ativos.`,
    ]

    if (request.difficulties) {
      parts.push(`O que atrapalhou foi: ${request.difficulties.toLowerCase()}`)
    }
    if (request.learnings) {
      parts.push(`E o que você tirou disso: ${request.learnings.toLowerCase()}`)
    }
    if (request.achievements) {
      parts.push(`Vale registrar: ${request.achievements.toLowerCase()}`)
    }

    return wait(parts.join(' '))
  }
}

function priorityRank(task: AiContextTask): number {
  return task.priority === 'alta' ? 3 : task.priority === 'media' ? 2 : 1
}

/** O primeiro dos próximos 7 dias sem ação marcada. Sem vaga, amanhã. */
function firstFreeDay(context: AiUserContext): DayKey {
  const busy = new Set(context.upcomingTasks.map((task) => task.day))
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = addDays(context.today, offset)
    if (!busy.has(day)) return day
  }
  return addDays(context.today, 1)
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** Quantas unidades cabem em um minuto. Página lê mais rápido que minuto passa. */
function unitPerMinute(unitLabel: string): number {
  return unitLabel.startsWith('pág') ? 1.2 : 1
}

function buildSteps(request: AiPlanRequest, weeks: number): string[] {
  const chunk = Math.ceil(request.target / Math.min(4, weeks))
  const count = Math.min(4, weeks)

  return Array.from({ length: count }, (_, index) => {
    const upTo = Math.min(request.target, chunk * (index + 1))
    return `Etapa ${index + 1}: chegar em ${upTo} ${request.unitLabel}`
  })
}

function buildHabits(request: AiPlanRequest, perDay: number): AiHabitSuggestion[] {
  return [
    {
      name: `${capitalize(request.axis)} todo dia`,
      icon: 'livro',
      frequency: 'diario',
      weekdays: [],
      timesPerWeek: 7,
      dayPart: 'qualquer',
      target: perDay,
      minimalTarget: Math.max(1, Math.round(perDay / 3)),
      rationale: 'É o hábito que carrega o volume. Sem ele o objetivo depende de força de vontade.',
    },
  ]
}

function buildTasks(request: AiPlanRequest, steps: readonly string[]): AiTaskSuggestion[] {
  return steps.map((step, index) => ({
    title: step,
    description: null,
    day: addDays(request.startedOn, index * 7) as DayKey,
    estimatedMin: Math.min(request.minutesPerDay, 45),
    effort: index === 0 ? 'leve' : 'medio',
    priority: index === 0 ? 'alta' : 'media',
    minimalVersion: null,
    order: index,
    stepIndex: index,
  }))
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function summaryOf(request: AiProgressRequest): string {
  if (request.momentum >= 70) {
    return `Momentum em ${request.momentum}: o ritmo está alto e você está sustentando ele.`
  }
  if (request.momentum >= 45) {
    return `Momentum em ${request.momentum}: ritmo constante, com espaço pra crescer sem forçar.`
  }
  if (request.activeDays === 0) {
    return 'Sem registro na janela. O número não mede desistência, mede ausência de dado.'
  }
  return `Momentum em ${request.momentum}: o ritmo caiu, mas ${request.activeDays} ${request.activeDays === 1 ? 'dia teve' : 'dias tiveram'} movimento.`
}

function nextActionOf(request: AiProgressRequest): string {
  if (request.overdueTasks > 0) return 'Abre o plano e resolve a ação atrasada mais antiga.'
  if (request.stalledObjectives.length > 0) {
    return `Cria uma ação pequena pro objetivo "${request.stalledObjectives[0]}", que está parado.`
  }
  if (request.plannedTodayMin > request.capacityMin) {
    return 'Escolhe uma ação do dia e adia o resto. Hoje não cabe tudo.'
  }
  return 'Conclui a prioridade principal de hoje antes de abrir qualquer outra frente.'
}
