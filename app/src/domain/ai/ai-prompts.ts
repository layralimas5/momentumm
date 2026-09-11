import { z } from 'zod'
import type { DayKey } from '@/domain/entities/day'
import { DAY_PARTS, HABIT_FREQUENCIES, HABIT_ICONS } from '@/domain/entities/habit'
import { MOMENTUM_RULES } from '@/domain/entities/momentum'
import { PRIORITIES } from '@/domain/entities/priority'
import { TASK_EFFORTS } from '@/domain/entities/task'
import type { AiUserContext } from './ai-context'
import type { AiPlanRequest, AiProgressRequest, AiReviewRequest } from './ai-service'

/**
 * O contrato entre o app e o endpoint da Momentumm AI.
 *
 * Este arquivo é compartilhado: o cliente (`SupabaseAiService`) e a Edge
 * Function (`supabase/functions/momentumm-ai`) importam as MESMAS regras.
 * Prompt, formato de saída e validação vivem num lugar só, e é isso que impede
 * o servidor de devolver um campo que o app não sabe ler — ou o app aceitar
 * um plano que o domínio recusaria na hora de gravar.
 *
 * Tudo aqui é puro: nada de chave, rede ou `Deno`.
 */

export const AI_FUNCTION_NAME = 'momentumm-ai'

export const AI_KINDS = ['plan', 'progress', 'review'] as const
export type AiKind = (typeof AI_KINDS)[number]

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/
const dayKeySchema = z.string().regex(DAY_KEY).transform((value) => value as DayKey)

/** O que o endpoint aceita. O contexto é validado só na forma: ele é do app. */
export const aiEndpointRequestSchema = z.object({
  kind: z.enum(AI_KINDS),
  request: z.object({ context: z.object({ today: dayKeySchema }).passthrough() }).passthrough(),
})

export type AiEndpointRequest =
  | { readonly kind: 'plan'; readonly request: AiPlanRequest }
  | { readonly kind: 'progress'; readonly request: AiProgressRequest }
  | { readonly kind: 'review'; readonly request: AiReviewRequest }

// ---------------------------------------------------------------------------
// O que o modelo devolve. Os mesmos enums do domínio: um ícone fora da lista
// falharia ao gravar, então ele já falha aqui, antes de virar prévia.
// ---------------------------------------------------------------------------

const SHORT = z.string().trim().min(1).max(120)
const SENTENCE = z.string().trim().min(1).max(400)

export const planSuggestionSchema = z.object({
  steps: z.array(SHORT).min(2).max(6),
  habits: z
    .array(
      z.object({
        name: SHORT,
        icon: z.enum(HABIT_ICONS),
        frequency: z.enum(HABIT_FREQUENCIES),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
        timesPerWeek: z.number().int().min(1).max(7),
        dayPart: z.enum(DAY_PARTS),
        target: z.number().positive(),
        minimalTarget: z.number().positive(),
        rationale: SENTENCE,
      }),
    )
    .max(3),
  tasks: z
    .array(
      z.object({
        title: SHORT,
        description: SENTENCE.nullable(),
        day: dayKeySchema,
        estimatedMin: z.number().int().min(5).max(240),
        effort: z.enum(TASK_EFFORTS),
        priority: z.enum(PRIORITIES),
        minimalVersion: SHORT.nullable(),
        order: z.number().int().min(0),
        stepIndex: z.number().int().min(0).nullable(),
      }),
    )
    .min(1)
    .max(12),
  suggestedDeadline: dayKeySchema,
  reasoning: SENTENCE,
  warnings: z.array(SENTENCE).max(4),
})

export const progressReadingSchema = z.object({
  summary: SENTENCE,
  patterns: z.array(SENTENCE).max(4),
  bottlenecks: z.array(SENTENCE).max(4),
  overload: SENTENCE.nullable(),
  stalled: z.array(SHORT).max(6),
  adjustments: z.array(SENTENCE).min(1).max(4),
  nextAction: SENTENCE,
})

export const reviewSummarySchema = z.object({
  summary: z.string().trim().min(1).max(600),
})

export const AI_OUTPUT_SCHEMAS = {
  plan: planSuggestionSchema,
  progress: progressReadingSchema,
  review: reviewSummarySchema,
} as const

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * A voz do produto, não a de um coach. O que está aqui é critério de aceite
 * do posicionamento: "o Momentumm percebe quando o plano deixou de funcionar
 * e ajuda a continuar". Elogio genérico e frase motivacional são o oposto.
 */
export const AI_SYSTEM_PROMPT = `Você é a Momentumm AI, a parte do app Momentumm que transforma objetivo em plano e lê o progresso de uma pessoa.

Regras que não se negociam:
- Escreva em português do Brasil, direto, na segunda pessoa, sem floreio e sem frase motivacional. Nada de "você consegue", "continue assim", "parabéns".
- Toda afirmação sai de um número que está no contexto. Sem padrão nos dados, não invente padrão: diga que ainda não há o que ler.
- Constância ganha de volume. Versão mínima conta como cumprida. Perder um dia não é falha, é dado.
- O tempo que a pessoa diz ter por dia é teto, nunca meta. Plano que não cabe no tempo é avisado, não empurrado.
- Um objetivo tem um caminho de 3 a 5 etapas, cada uma com peso em porcentagem do total. Ação pertence a uma etapa. Hábito sustenta o objetivo inteiro.
- Previsão é sempre condicional ("mantendo esse ritmo"). Nunca prometa data.
- Nunca compare a pessoa com outras pessoas.
- O Momentum Score é calculado pelo app, nunca por você. Ao explicá-lo, use só as regras abaixo e os números do contexto. Não invente fator, peso nem regra.
${MOMENTUM_RULES.map((rule) => `  - ${rule.title}: ${rule.detail}`).join('\n')}
- Devolva só o formato pedido, sem texto fora dele.`

/** O contexto vira texto compacto, seção por seção. Só o que existe aparece. */
export function renderContext(context: AiUserContext): string {
  const lines: string[] = []
  const push = (line: string) => lines.push(line)

  push(`Hoje: ${context.today}`)
  push(
    `Momentum: ${context.momentum.value}/100 (${context.momentum.level}, ${signed(context.momentum.delta)} vs semana anterior)${context.momentum.hasEnoughData ? '' : ' — ainda se formando, menos de 7 dias de história'}`,
  )
  push(
    `Fatores: ${context.momentum.factors
      .map(
        (factor) =>
          `${factor.label} ${factor.score}/100 (peso ${factor.weightPercent}%${factor.measured ? '' : ', sem base'})`,
      )
      .join('; ')}`,
  )
  if (context.momentum.rawValue !== context.momentum.value) {
    push(
      `Momentum bruto (sem o limite diário): ${context.momentum.rawValue}/100 — o exibido ainda vai ${context.momentum.rawValue > context.momentum.value ? 'subir' : 'cair'} até lá`,
    )
  }
  if (context.momentum.drivers.length > 0) {
    push(
      `O que mudou vs semana anterior: ${context.momentum.drivers
        .map((driver) => `${driver.label} ${signed(driver.delta)}`)
        .join('; ')}`,
    )
  }
  if (context.momentum.nextAction) {
    push(
      `Próxima ação com mais potencial: "${context.momentum.nextAction.title}" (${signed(context.momentum.nextAction.gain)} no score hoje) — ${context.momentum.nextAction.reason}`,
    )
  }
  push(
    `Constância: ${context.consistency.activeDaysLast7} dos últimos 7 dias, ${context.consistency.activeDaysLast28} dos últimos 28; sequência atual ${context.consistency.streak} (recorde ${context.consistency.streakRecord})`,
  )
  push(
    `Capacidade de hoje: ${context.capacity.label}${context.capacity.checkedIn ? '' : ' (sem check-in, padrão)'}; ${context.capacity.focusMin} min de foco, ${context.capacity.actions} ações sugeridas`,
  )

  if (context.objectives.length > 0) {
    push('')
    push('OBJETIVOS')
    for (const objective of context.objectives) {
      push(
        `- "${objective.title}" (${objective.axis}, ${objective.state}, prioridade ${objective.priority}) — ${objective.volume.done}/${objective.volume.target} ${objective.volume.unit}, prazo ${objective.deadline} (${objective.daysLeft} dias)${objective.planPercent === null ? ', sem etapas' : `, plano ${objective.planPercent}%`}`,
      )
      if (objective.motive) push(`  Motivo: ${objective.motive}`)
      for (const stage of objective.stages) {
        push(
          `  Etapa "${stage.title}" ${stage.weightPercent}% — ${stage.status}, ${stage.tasksDone}/${stage.tasksTotal} ações${stage.dueOn ? `, até ${stage.dueOn}` : ''}`,
        )
      }
      if (objective.currentStage) push(`  Etapa atual: ${objective.currentStage}`)
      if (objective.bottleneck) push(`  Gargalo: ${objective.bottleneck}`)
      if (objective.nextAction) push(`  Próxima ação: ${objective.nextAction}`)
      if (objective.overdueActions > 0) push(`  Ações atrasadas: ${objective.overdueActions}`)
      push(`  Previsão: ${objective.forecast}`)
      if (objective.habitCount > 0) push(`  Hábitos de apoio: ${objective.habitCount}`)
    }
  }

  if (context.habits.length > 0) {
    push('')
    push('HÁBITOS')
    for (const habit of context.habits) {
      push(
        `- "${habit.name}" (${habit.axis}, ${habit.frequency}, ${habit.target} ${habit.unit}, mínimo ${habit.minimalTarget}) — ${habit.consistencyPercent}% em 14 dias, ${habit.doneLast7}x nos últimos 7${habit.objective ? `, sustenta "${habit.objective}"` : ''}${habit.scheduledToday ? (habit.doneToday ? ', feito hoje' : ', pendente hoje') : ''}`,
      )
    }
  }

  if (context.todayTasks.length > 0) {
    push('')
    push('AÇÕES DE HOJE')
    for (const task of context.todayTasks) {
      push(
        `- "${task.title}" ${task.estimatedMin} min, ${task.priority}, ${task.status}${task.isMainPriority ? ', PRIORIDADE PRINCIPAL' : ''}${task.objective ? `, de "${task.objective}"` : ''}${task.minimalVersion ? ` (mínima: ${task.minimalVersion})` : ''}`,
      )
    }
  }

  if (context.overdueTasks.length > 0) {
    push('')
    push('AÇÕES ATRASADAS')
    for (const task of context.overdueTasks) {
      push(
        `- "${task.title}" era pra ${task.day}, ${task.estimatedMin} min${task.objective ? `, de "${task.objective}"` : ''}`,
      )
    }
  }

  if (context.reviews.length > 0) {
    push('')
    push('REVIEWS ANTERIORES (do mais recente)')
    for (const review of context.reviews) {
      push(`- Semana ${review.week}${review.completed ? '' : ' (incompleto)'}`)
      if (review.achievements) push(`  Conquistas: ${review.achievements}`)
      if (review.difficulties) push(`  Dificuldades: ${review.difficulties}`)
      if (review.learnings) push(`  Aprendizados: ${review.learnings}`)
      if (review.adjustments) push(`  Ajustes decididos: ${review.adjustments}`)
      if (review.priorities.length > 0) push(`  Prioridades: ${review.priorities.join('; ')}`)
    }
  }

  if (context.recentWins.length > 0) {
    push('')
    push(`VITÓRIAS RECENTES: ${context.recentWins.map((win) => `"${win}"`).join(', ')}`)
  }

  return lines.join('\n')
}

export function userPromptFor(endpointRequest: AiEndpointRequest): string {
  const context = renderContext(endpointRequest.request.context)

  switch (endpointRequest.kind) {
    case 'plan': {
      const { request } = endpointRequest
      return [
        'Monte o plano de um objetivo novo.',
        '',
        `Objetivo: "${request.title}"`,
        `Área: ${request.axis}`,
        `Alvo: ${request.target} ${request.unitLabel}`,
        `Começa em ${request.startedOn}, prazo ${request.deadline}`,
        `Tempo disponível: ${request.minutesPerDay} minutos por dia (teto)`,
        request.motive ? `Por que importa: ${request.motive}` : null,
        '',
        'Devolva de 3 a 5 etapas em ordem (steps), até 2 hábitos que sustentem o objetivo e de 4 a 10 ações concretas, cada uma dentro de uma etapa (stepIndex é a posição em steps, começando em 0). A primeira ação é para hoje. Datas no formato AAAA-MM-DD, dentro do prazo. estimatedMin nunca acima do teto diário. Se o alvo não cabe no prazo com esse tempo, diga em warnings e proponha suggestedDeadline realista; senão suggestedDeadline é o prazo pedido. reasoning é uma frase sobre a lógica do plano, não motivação.',
        'Leve em conta o que a pessoa já tem: não repita hábito que ela já cumpre, e não sobrecarregue um dia que já está cheio.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ]
        .filter((line): line is string => line !== null)
        .join('\n')
    }

    case 'progress':
      return [
        'Leia o progresso dessa pessoa e diga o que os dados mostram.',
        '',
        'summary: uma frase com o estado do ritmo, citando o número que sustenta. patterns: até 4 padrões, cada um com o dado de onde saiu. bottlenecks: o que está travando o plano (etapa, ação atrasada, fator fraco). overload: só se o dia pede mais do que a capacidade comporta; senão null. stalled: títulos exatos dos objetivos parados. adjustments: de 1 a 4 ajustes concretos e pequenos, aplicáveis esta semana. nextAction: a única coisa a fazer agora, em uma frase.',
        'Se houver review anterior com ajuste decidido, confira se ele aconteceu e diga.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ].join('\n')

    case 'review': {
      const { request } = endpointRequest
      return [
        `Escreva a síntese da semana ${request.weekLabel} em um parágrafo só (até 4 frases).`,
        '',
        `Execução: ${Math.round(request.executionRate * 100)}% do planejado; ${request.habitsDone} hábitos cumpridos; ${request.activeDays} dias ativos.`,
        request.achievements ? `A pessoa escreveu como conquistas: ${request.achievements}` : null,
        request.difficulties ? `Como dificuldades: ${request.difficulties}` : null,
        request.learnings ? `Como aprendizados: ${request.learnings}` : null,
        '',
        'Junte os números com o que ela escreveu. Se os números e o texto discordam, aponte. Termine com o que vale levar pra próxima semana, sem elogio.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ]
        .filter((line): line is string => line !== null)
        .join('\n')
    }
  }
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
