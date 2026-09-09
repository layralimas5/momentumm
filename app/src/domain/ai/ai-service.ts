import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { DayPart, HabitFrequency, HabitIcon } from '@/domain/entities/habit'
import type { Priority } from '@/domain/entities/priority'
import type { TaskEffort } from '@/domain/entities/task'

/**
 * Momentumm AI — a porta.
 *
 * O domínio descreve o que a IA precisa devolver, não como ela é chamada.
 * Nenhuma chave, nenhum modelo e nenhum endpoint aparecem aqui: a implementação
 * real mora na infraestrutura e, quando existir, vai passar por um endpoint
 * próprio no servidor. Chave de LLM no frontend é chave pública.
 *
 * As duas funções do V1 são deliberadamente estreitas:
 *
 *   1. `buildPlan`   — objetivo vira etapas, hábitos e ações
 *   2. `readProgress` — os dados viram leitura curta e um próximo passo
 *
 * As duas devolvem estrutura, não texto solto. É isso que permite a prévia
 * editável antes de salvar: a pessoa mexe em cada ação, e o app grava com as
 * mesmas regras de domínio de um plano feito na mão.
 */

export interface AiPlanRequest {
  readonly title: string
  readonly axis: ActivityTypeSlug
  readonly target: number
  readonly unitLabel: string
  readonly startedOn: DayKey
  readonly deadline: DayKey
  readonly minutesPerDay: number
  readonly motive: string | null
}

export interface AiHabitSuggestion {
  readonly name: string
  readonly icon: HabitIcon
  readonly frequency: HabitFrequency
  readonly weekdays: readonly number[]
  readonly timesPerWeek: number
  readonly dayPart: DayPart
  readonly target: number
  readonly minimalTarget: number
  readonly rationale: string
}

export interface AiTaskSuggestion {
  readonly title: string
  readonly description: string | null
  readonly day: DayKey
  readonly estimatedMin: number
  readonly effort: TaskEffort
  readonly priority: Priority
  readonly minimalVersion: string | null
  readonly order: number
  /**
   * A etapa a que a ação pertence, pela posição em `steps`. Null é ação sem
   * etapa: legítima, mas ela não empurra progresso nenhum até ganhar destino.
   *
   * É esse índice que faz a etapa da prévia virar etapa de verdade no banco —
   * sem ele o plano da IA nasceria como lista de tarefas, que é exatamente o
   * que a hierarquia existe pra evitar.
   */
  readonly stepIndex: number | null
}

export interface AiPlanSuggestion {
  /** As etapas do caminho, em ordem. É o que a prévia mostra primeiro. */
  readonly steps: readonly string[]
  readonly habits: readonly AiHabitSuggestion[]
  readonly tasks: readonly AiTaskSuggestion[]
  /** Prazo que a IA acha realista, quando difere do pedido. */
  readonly suggestedDeadline: DayKey
  /** Uma frase sobre a lógica do plano. Não é motivação, é justificativa. */
  readonly reasoning: string
  /** Avisos honestos: alvo grande demais, prazo curto demais. */
  readonly warnings: readonly string[]
}

export interface AiProgressRequest {
  readonly momentum: number
  readonly momentumLevel: string
  readonly activeDays: number
  readonly windowDays: number
  readonly habitRate: number
  readonly taskRate: number
  readonly stalledObjectives: readonly string[]
  readonly overdueTasks: number
  readonly plannedTodayMin: number
  readonly capacityMin: number
  readonly weakestFactor: string | null
}

export interface AiProgressReading {
  readonly summary: string
  readonly patterns: readonly string[]
  readonly bottlenecks: readonly string[]
  /** Sinal de que a pessoa está carregando mais do que o dia comporta. */
  readonly overload: string | null
  readonly stalled: readonly string[]
  readonly adjustments: readonly string[]
  readonly nextAction: string
}

export interface AiReviewRequest {
  readonly weekLabel: string
  readonly executionRate: number
  readonly habitsDone: number
  readonly activeDays: number
  readonly achievements: string | null
  readonly difficulties: string | null
  readonly learnings: string | null
}

export interface AiService {
  /** A implementação simulada responde true aqui pra tela poder avisar. */
  readonly simulated: boolean
  buildPlan(request: AiPlanRequest): Promise<AiPlanSuggestion>
  readProgress(request: AiProgressRequest): Promise<AiProgressReading>
  summarizeReview(request: AiReviewRequest): Promise<string>
}
