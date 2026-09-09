import type {
  AiHabitSuggestion,
  AiPlanRequest,
  AiPlanSuggestion,
  AiProgressReading,
  AiProgressRequest,
  AiReviewRequest,
  AiService,
  AiTaskSuggestion,
} from '@/domain/ai/ai-service'
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

    const overload =
      request.plannedTodayMin > request.capacityMin
        ? `Hoje o plano pede ${request.plannedTodayMin} minutos e a tua capacidade de hoje é ${request.capacityMin}.`
        : null

    if (overload) adjustments.push('Tira do dia o que não muda nada se sair amanhã.')

    return wait({
      summary: summaryOf(request),
      patterns,
      bottlenecks,
      overload,
      stalled: request.stalledObjectives,
      adjustments: adjustments.length > 0 ? adjustments : ['Segue como está. O ritmo está sustentável.'],
      nextAction: nextActionOf(request),
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
