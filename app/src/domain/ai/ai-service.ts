import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { DayPart, HabitFrequency, HabitIcon } from '@/domain/entities/habit'
import type { Priority } from '@/domain/entities/priority'
import type { TaskEffort } from '@/domain/entities/task'
import type { AiUserContext } from './ai-context'

/**
 * Momentumm AI — a porta.
 *
 * O domínio descreve o que a IA precisa devolver, não como ela é chamada.
 * Nenhuma chave, nenhum modelo e nenhum endpoint aparecem aqui: a implementação
 * real mora na infraestrutura e, quando existir, vai passar por um endpoint
 * próprio no servidor. Chave de LLM no frontend é chave pública.
 *
 * As funções do V1 são deliberadamente estreitas, uma por porta de entrada:
 *
 *   1. `buildPlan`      — objetivo vira etapas, hábitos e ações (Objetivos)
 *   2. `reorganizeDay`  — o dia contra a capacidade real (Hoje)
 *   3. `readProgress`   — os dados viram diagnóstico e ajustes (Progresso)
 *   4. `draftReview`    — a review semanal pré-escrita pelos dados (Review)
 *   5. `planRecovery`   — o plano de volta, sem culpa (Modo Retomada)
 *   6. `summarizeReview` — a síntese da semana já respondida
 *
 * Nenhuma delas é chat. Todas devolvem estrutura, não texto solto: é isso que
 * permite a prévia editável antes de salvar — a pessoa aceita, edita ou
 * rejeita cada item, e o app grava com as mesmas regras de domínio de um
 * plano feito na mão. Nada é escrito sem confirmação.
 *
 * Todo ajuste proposto é um `AiAdjustment`: um tipo fechado, com o alvo
 * apontado por REF (o apelido que o contexto deu) e o motivo em uma frase.
 * O app sabe executar cada tipo; um tipo que não existe aqui não existe.
 *
 * Todo pedido carrega o `context` (ver `ai-context`): objetivos com plano e
 * previsão, hábitos com constância, o dia, os reviews anteriores e o score
 * aberto. Os campos soltos ao lado dele são o resumo que a implementação
 * simulada consegue ler; a real lê o contexto inteiro.
 */

export interface AiPlanRequest {
  /** A conta inteira, do jeito que `buildAiContext` monta. */
  readonly context: AiUserContext
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
  readonly context: AiUserContext
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
  /** Os ajustes que dá pra aplicar com um toque, cada um com o motivo. */
  readonly proposals: readonly AiAdjustment[]
}

export interface AiReviewRequest {
  readonly context: AiUserContext
  readonly weekLabel: string
  readonly executionRate: number
  readonly habitsDone: number
  readonly activeDays: number
  readonly achievements: string | null
  readonly difficulties: string | null
  readonly learnings: string | null
}

// ---------------------------------------------------------------------------
// Ajustes: o que a IA pode propor e o app sabe aplicar.
// ---------------------------------------------------------------------------

export const AI_ADJUSTMENT_TYPES = [
  'move_action',
  'shrink_action',
  'set_minutes',
  'set_main_priority',
  'extend_deadline',
  'change_habit_frequency',
  'create_action',
] as const
export type AiAdjustmentType = (typeof AI_ADJUSTMENT_TYPES)[number]

interface AiAdjustmentBase {
  /** Uma frase com o dado que motivou. Sem motivo o ajuste não entra. */
  readonly reason: string
}

export type AiAdjustment =
  | (AiAdjustmentBase & { readonly type: 'move_action'; readonly ref: string; readonly toDay: DayKey })
  | (AiAdjustmentBase & { readonly type: 'shrink_action'; readonly ref: string })
  | (AiAdjustmentBase & { readonly type: 'set_minutes'; readonly ref: string; readonly estimatedMin: number })
  | (AiAdjustmentBase & { readonly type: 'set_main_priority'; readonly ref: string })
  | (AiAdjustmentBase & { readonly type: 'extend_deadline'; readonly ref: string; readonly toDay: DayKey })
  | (AiAdjustmentBase & {
      readonly type: 'change_habit_frequency'
      readonly ref: string
      readonly timesPerWeek: number
      readonly weekdays: readonly number[]
    })
  | (AiAdjustmentBase & {
      readonly type: 'create_action'
      readonly title: string
      readonly day: DayKey
      readonly estimatedMin: number
      readonly minimalVersion: string | null
      /** Ref do objetivo que a ação empurra. Null é caixa de entrada. */
      readonly objectiveRef: string | null
    })

// ---------------------------------------------------------------------------
// Hoje: reorganizar o dia contra a capacidade real.
// ---------------------------------------------------------------------------

export interface AiDayRequest {
  readonly context: AiUserContext
  /** O tempo que a pessoa disse ter hoje. Teto, nunca meta. */
  readonly availableMin: number
  readonly plannedMin: number
}

export interface AiDayPlan {
  /** Uma frase: o que o dia pede contra o que cabe, com os minutos. */
  readonly summary: string
  readonly fits: boolean
  readonly adjustments: readonly AiAdjustment[]
  readonly reasoning: string
}

// ---------------------------------------------------------------------------
// Review: a revisão pré-escrita pelos dados, pra pessoa corrigir.
// ---------------------------------------------------------------------------

export interface AiReviewDraftRequest {
  readonly context: AiUserContext
  readonly weekLabel: string
  readonly executionRate: number
  readonly habitsDone: number
  readonly habitsPlanned: number
  readonly tasksDone: number
  readonly tasksPlanned: number
  readonly activeDays: number
  readonly focusMinutes: number
  /** O que ela já escreveu, pra IA completar e não sobrescrever. */
  readonly written: {
    readonly achievements: string | null
    readonly difficulties: string | null
    readonly learnings: string | null
    readonly adjustments: string | null
  }
}

export interface AiReviewDraft {
  readonly achievements: string
  readonly difficulties: string
  readonly learnings: string
  readonly adjustments: string
  readonly priorities: readonly string[]
  /** De onde saiu cada resposta: os números citados. */
  readonly basis: string
}

// ---------------------------------------------------------------------------
// Modo Retomada: o plano de volta.
// ---------------------------------------------------------------------------

export interface AiRecoveryRequest {
  readonly context: AiUserContext
  /** Os sinais que ligaram o modo, com o número de cada um. */
  readonly signals: readonly string[]
  readonly daysSinceLastMove: number
}

export interface AiRecoveryPlan {
  /** A leitura do que aconteceu, sem contar dias perdidos e sem culpa. */
  readonly opening: string
  /** Até três passos pequenos. Trazer, encolher ou criar. */
  readonly adjustments: readonly AiAdjustment[]
  /** Refs dos hábitos que valem manter na versão mínima esta semana. */
  readonly keepHabits: readonly string[]
  readonly reasoning: string
}

/** Quanto da franquia mensal já foi usado, como o servidor contou. */
export interface AiQuota {
  readonly used: number
  readonly limit: number
}

/**
 * O toque do coach: a leitura curta e dura no fim das métricas.
 *
 * Não é diagnóstico (isso é `readProgress`) nem plano: são três linhas que
 * cobram, com número, e mandam fazer uma coisa hoje. Tom agressivo é pedido
 * do produto pra quem é PRO; o limite é ofensa pessoal, que nunca entra.
 */
export interface AiCoachRequest {
  readonly context: AiUserContext
  readonly momentum: number
  readonly momentumLevel: string
  readonly weekXp: number
  readonly previousWeekXp: number
  readonly level: number
  readonly levelName: string
  readonly xpToNext: number
  readonly streak: number
  readonly streakRecord: number
  readonly activeDays: number
  readonly windowDays: number
  readonly stalledObjectives: readonly string[]
  readonly overdueTasks: number
  readonly nextAction: string | null
}

export interface AiCoachNudge {
  /** A frase de impacto, curta. */
  readonly punch: string
  /** A verdade desconfortável tirada dos números. */
  readonly truth: string
  /** A ordem: uma coisa só, pra hoje. */
  readonly order: string
}

export interface AiService {
  /** A implementação simulada responde true aqui pra tela poder avisar. */
  readonly simulated: boolean
  /** A última contagem que o servidor devolveu. Null enquanto ninguém chamou. */
  readonly quota: AiQuota | null
  buildPlan(request: AiPlanRequest): Promise<AiPlanSuggestion>
  reorganizeDay(request: AiDayRequest): Promise<AiDayPlan>
  readProgress(request: AiProgressRequest): Promise<AiProgressReading>
  draftReview(request: AiReviewDraftRequest): Promise<AiReviewDraft>
  planRecovery(request: AiRecoveryRequest): Promise<AiRecoveryPlan>
  summarizeReview(request: AiReviewRequest): Promise<string>
  coach(request: AiCoachRequest): Promise<AiCoachNudge>
}
