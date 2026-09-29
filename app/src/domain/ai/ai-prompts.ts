// `zod/v4`, não `zod`: o `zodOutputFormat` do SDK da Anthropic gera o JSON
// Schema com `z.toJSONSchema` da v4, que recusa schema construído pela API v3.
import { z } from 'zod/v4'
import type { DayKey } from '@/domain/entities/day'
import { DAY_PARTS, HABIT_FREQUENCIES, HABIT_ICONS } from '@/domain/entities/habit'
import { MOMENTUM_RULES } from '@/domain/entities/momentum'
import { PRIORITIES } from '@/domain/entities/priority'
import { TASK_EFFORTS } from '@/domain/entities/task'
import type { AiUserContext } from './ai-context'
import type {
  AiDayRequest,
  AiPlanRequest,
  AiProgressRequest,
  AiCoachRequest,
  AiRecoveryRequest,
  AiReviewDraftRequest,
  AiReviewRequest,
} from './ai-service'

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

export const AI_KINDS = ['plan', 'day', 'progress', 'review', 'review_draft', 'recovery', 'coach'] as const
export type AiKind = (typeof AI_KINDS)[number]

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/
// Sem `.transform`: a saída estruturada da Anthropic vira JSON Schema, e
// transform não tem representação lá. O brand entra por tipo, não por runtime.
const dayKeySchema = z.string().regex(DAY_KEY) as unknown as z.ZodType<DayKey, string>

/** O que o endpoint aceita. O contexto é validado só na forma: ele é do app. */
export const aiEndpointRequestSchema = z.object({
  kind: z.enum(AI_KINDS),
  request: z.object({ context: z.object({ today: dayKeySchema }).passthrough() }).passthrough(),
})

export type AiEndpointRequest =
  | { readonly kind: 'plan'; readonly request: AiPlanRequest }
  | { readonly kind: 'day'; readonly request: AiDayRequest }
  | { readonly kind: 'progress'; readonly request: AiProgressRequest }
  | { readonly kind: 'review'; readonly request: AiReviewRequest }
  | { readonly kind: 'review_draft'; readonly request: AiReviewDraftRequest }
  | { readonly kind: 'recovery'; readonly request: AiRecoveryRequest }
  | { readonly kind: 'coach'; readonly request: AiCoachRequest }

// ---------------------------------------------------------------------------
// O que o modelo devolve. Os mesmos enums do domínio: um ícone fora da lista
// falharia ao gravar, então ele já falha aqui, antes de virar prévia.
// ---------------------------------------------------------------------------

const SHORT = z.string().trim().min(1).max(120)
const SENTENCE = z.string().trim().min(1).max(400)

const planStepSchema = z.object({
  title: SHORT,
  description: SENTENCE,
  weight: z.number().int().min(5).max(70),
})

export const planSuggestionSchema = z.object({
  /*
    A etapa deixou de ser uma string.

    Com título só, o objetivo nascia sem descrição e com pesos iguais, e o
    plano da IA perdia o que ela tinha pra dizer: que a primeira etapa é curta,
    que o trabalho está no meio, e por quê. O peso não é validado como soma
    aqui porque `refine` não tem representação em JSON Schema (é o que a saída
    estruturada consome); quem fecha os 100 é `normalizeStepWeights`, no
    domínio, depois de ler.
  */
  steps: z.array(planStepSchema).min(3).max(5),
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
    .max(4),
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
    .max(16),
  suggestedDeadline: dayKeySchema,
  reasoning: SENTENCE,
  warnings: z.array(SENTENCE).max(4),
})

/**
 * O ajuste, um tipo por vez. Os refs são os apelidos do contexto (`a3`,
 * `o1`, `h2`): o app traduz pra id na hora de aplicar e descarta o que não
 * bate. `reason` é obrigatório porque sugestão sem motivo não é sugestão, é
 * ordem.
 */
const REF = z.string().trim().regex(/^[aoh]\d{1,3}$/)
const REASON = SENTENCE

export const aiAdjustmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move_action'), ref: REF, toDay: dayKeySchema, reason: REASON }),
  z.object({ type: z.literal('shrink_action'), ref: REF, reason: REASON }),
  z.object({
    type: z.literal('set_minutes'),
    ref: REF,
    estimatedMin: z.number().int().min(5).max(240),
    reason: REASON,
  }),
  z.object({ type: z.literal('set_main_priority'), ref: REF, reason: REASON }),
  z.object({ type: z.literal('extend_deadline'), ref: REF, toDay: dayKeySchema, reason: REASON }),
  z.object({
    type: z.literal('change_habit_frequency'),
    ref: REF,
    timesPerWeek: z.number().int().min(1).max(7),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    reason: REASON,
  }),
  z.object({
    type: z.literal('create_action'),
    title: SHORT,
    day: dayKeySchema,
    estimatedMin: z.number().int().min(5).max(240),
    minimalVersion: SHORT.nullable(),
    objectiveRef: REF.nullable(),
    reason: REASON,
  }),
])

export const dayPlanSchema = z.object({
  summary: SENTENCE,
  fits: z.boolean(),
  adjustments: z.array(aiAdjustmentSchema).max(8),
  reasoning: SENTENCE,
})

export const progressReadingSchema = z.object({
  summary: SENTENCE,
  patterns: z.array(SENTENCE).max(4),
  bottlenecks: z.array(SENTENCE).max(4),
  overload: SENTENCE.nullable(),
  stalled: z.array(SHORT).max(6),
  adjustments: z.array(SENTENCE).min(1).max(4),
  nextAction: SENTENCE,
  proposals: z.array(aiAdjustmentSchema).max(4),
})

export const reviewSummarySchema = z.object({
  summary: z.string().trim().min(1).max(600),
})

const ANSWER = z.string().trim().min(1).max(600)

export const reviewDraftSchema = z.object({
  achievements: ANSWER,
  difficulties: ANSWER,
  learnings: ANSWER,
  adjustments: ANSWER,
  priorities: z.array(SHORT).min(1).max(3),
  basis: SENTENCE,
})

export const recoveryPlanSchema = z.object({
  opening: z.string().trim().min(1).max(400),
  adjustments: z.array(aiAdjustmentSchema).min(1).max(3),
  keepHabits: z.array(REF).max(3),
  reasoning: SENTENCE,
})

export const coachNudgeSchema = z.object({
  punch: z.string().trim().min(1).max(120),
  truth: z.string().trim().min(1).max(220),
  order: z.string().trim().min(1).max(160),
})

/**
 * O que o app PEDE ao modelo. Vira JSON Schema pra saída estruturada, então
 * ele é estrito: união e `refine` não têm representação lá, e um schema
 * ambíguo faz o modelo escolher o formato errado.
 */
export const AI_OUTPUT_SCHEMAS = {
  plan: planSuggestionSchema,
  day: dayPlanSchema,
  progress: progressReadingSchema,
  review: reviewSummarySchema,
  review_draft: reviewDraftSchema,
  recovery: recoveryPlanSchema,
  coach: coachNudgeSchema,
} as const

/**
 * A etapa como o servidor ANTIGO devolvia: uma string solta.
 *
 * Ela existe porque o app e a Edge Function sobem SEPARADOS. Entre publicar o
 * front e rodar `npm run ai:deploy` existe uma janela em que o cliente novo
 * conversa com o servidor velho, e foi exatamente o que aconteceu: o front
 * subiu primeiro, o servidor continuou mandando `steps: string[]`, e o cliente
 * recusou a resposta inteira com "a IA devolveu um formato que o app não
 * reconhece". Quem pediu um plano naquele intervalo levou um erro.
 *
 * O conserto não é lembrar de publicar na ordem: é o cliente aceitar o formato
 * anterior. Peça o formato novo, aceite os dois — a única postura que
 * sobrevive a dois artefatos que não sobem juntos.
 */
const legacyStepSchema = SHORT.transform((title) => ({
  title,
  /* Sem descrição, o título vira a própria explicação: é o que havia. */
  description: title,
  weight: 0,
}))

/**
 * O que o app ACEITA ler. Só `plan` difere: os outros tipos não mudaram de
 * forma, então eles são o mesmo schema.
 */
export const AI_READ_SCHEMAS = {
  ...AI_OUTPUT_SCHEMAS,
  plan: planSuggestionSchema.extend({
    steps: z.array(z.union([planStepSchema, legacyStepSchema])).min(1).max(6),
  }),
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
- Nunca use travessão (—) nem meia-risca (–) no texto. Separe ideias com vírgula, ponto, dois pontos ou parênteses.
- Toda afirmação sai de um número que está no contexto. Sem padrão nos dados, não invente padrão: diga que ainda não há o que ler.
- Constância ganha de volume. Versão mínima conta como cumprida. Perder um dia não é falha, é dado.
- O tempo que a pessoa diz ter por dia é teto, nunca meta. Plano que não cabe no tempo é avisado, não empurrado.
- Um objetivo tem um caminho de 3 a 5 etapas, cada uma com peso em porcentagem do total. Ação pertence a uma etapa. Hábito sustenta o objetivo inteiro.
- Previsão é sempre condicional ("mantendo esse ritmo"). Nunca prometa data.
- Nunca compare a pessoa com outras pessoas.
- Nenhum diagnóstico médico ou psicológico. Cansaço, ansiedade e sono são dados de contexto, nunca conclusão.
- Quando você propõe um ajuste, ele aponta pro item pelo ref do contexto (a1, o2, h1) e traz o motivo com o número que o sustenta. Você propõe; a pessoa decide. Nunca escreva como se já tivesse mudado alguma coisa.
- O Momentumm Score é calculado pelo app, nunca por você. Ao explicá-lo, use só as regras abaixo e os números do contexto. Não invente fator, peso nem regra.
${MOMENTUM_RULES.map((rule) => `  - ${rule.title}: ${rule.detail}`).join('\n')}
- Devolva só o formato pedido, sem texto fora dele.`

/** O contexto vira texto compacto, seção por seção. Só o que existe aparece. */
export function renderContext(context: AiUserContext): string {
  const lines: string[] = []
  const push = (line: string) => lines.push(line)

  push(`Hoje: ${context.today}`)
  push(
    `Momentumm: ${context.momentum.value}/100 (${context.momentum.level}, ${signed(context.momentum.delta)} vs semana anterior)${context.momentum.hasEnoughData ? '' : ' · ainda se formando, menos de 7 dias de história'}`,
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
      `Momentumm bruto (sem o limite diário): ${context.momentum.rawValue}/100 · o exibido ainda vai ${context.momentum.rawValue > context.momentum.value ? 'subir' : 'cair'} até lá`,
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
      `Próxima ação com mais potencial: "${context.momentum.nextAction.title}" (${signed(context.momentum.nextAction.gain)} no score hoje) · ${context.momentum.nextAction.reason}`,
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
        `- [${objective.ref}] "${objective.title}" (${objective.axis}, ${objective.state}, prioridade ${objective.priority}) · ${objective.volume.done}/${objective.volume.target} ${objective.volume.unit}, prazo ${objective.deadline} (${objective.daysLeft} dias)${objective.planPercent === null ? ', sem etapas' : `, plano ${objective.planPercent}%`}`,
      )
      if (objective.motive) push(`  Motivo: ${objective.motive}`)
      for (const stage of objective.stages) {
        push(
          `  Etapa "${stage.title}" ${stage.weightPercent}% · ${stage.status}, ${stage.tasksDone}/${stage.tasksTotal} ações${stage.dueOn ? `, até ${stage.dueOn}` : ''}`,
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
        `- [${habit.ref}] "${habit.name}" (${habit.axis}, ${habit.frequency}, ${habit.target} ${habit.unit}, mínimo ${habit.minimalTarget}) · ${habit.consistencyPercent}% em 14 dias, ${habit.doneLast7}x nos últimos 7${habit.objective ? `, sustenta "${habit.objective}"` : ''}${habit.scheduledToday ? (habit.doneToday ? ', feito hoje' : ', pendente hoje') : ''}`,
      )
    }
  }

  if (context.routine.length > 0) {
    push('')
    push('ROTINA DE HOJE (o dia já tem estas coisas dentro; não proponha nada por cima)')
    for (const item of context.routine) {
      push(
        `- ${item.time ? `${item.time} ` : ''}"${item.title}"${item.durationMin ? ` (${item.durationMin} min)` : ''}${item.ofObjective ? ', de um objetivo' : ''}${item.done ? ' · feito' : ''}`,
      )
    }
  }

  if (context.todayTasks.length > 0) {
    push('')
    push('AÇÕES DE HOJE')
    for (const task of context.todayTasks) {
      push(
        `- [${task.ref}] "${task.title}" ${task.estimatedMin} min, ${task.priority}, ${task.status}${task.isMainPriority ? ', PRIORIDADE PRINCIPAL' : ''}${task.objective ? `, de "${task.objective}"` : ''}${task.minimalVersion ? ` (mínima: ${task.minimalVersion})` : ''}`,
      )
    }
  }

  if (context.overdueTasks.length > 0) {
    push('')
    push('AÇÕES ATRASADAS')
    for (const task of context.overdueTasks) {
      push(
        `- [${task.ref}] "${task.title}" era pra ${task.day}, ${task.estimatedMin} min${task.objective ? `, de "${task.objective}"` : ''}`,
      )
    }
  }

  if (context.upcomingTasks.length > 0) {
    push('')
    push('AÇÕES DOS PRÓXIMOS 7 DIAS')
    for (const task of context.upcomingTasks) {
      push(
        `- [${task.ref}] "${task.title}" em ${task.day}, ${task.estimatedMin} min${task.objective ? `, de "${task.objective}"` : ''}${task.minimalVersion ? ` (mínima: ${task.minimalVersion})` : ''}`,
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

/**
 * O que separa um plano de uma lista de tarefas.
 *
 * O prompt antigo pedia "3 a 5 etapas, 2 hábitos e 4 a 10 ações" e mais nada
 * sobre o CONTEÚDO, então o modelo devolvia um plano genérico bem formatado:
 * "entrar no ritmo", "manter a constância", "fazer a primeira sessão". Era o
 * mesmo plano pra emagrecer e pra aprender alemão, que é exatamente a queixa
 * que o gerador determinístico já tinha.
 *
 * Estas regras existem pra o raciocínio do modelo ir pro assunto, e não pro
 * formato. A regra da cobertura é a que mais muda o resultado: ela obriga a
 * perguntar "o que esse objetivo exige que não está no título".
 */
const PLAN_RULES = [
  'REGRAS DO PLANO',
  '- O plano precisa fazer sentido PRO ASSUNTO. "Emagrecer" não é um objetivo de treino: é treino, comida, sono e medição, e um plano que só fala de treino já nasce errado. Antes de escrever, liste pra você mesma o que esse objetivo exige que não está escrito no título, e cubra isso.',
  '- Ação concreta é a que a pessoa sabe executar sem pensar mais: "Pesar e tirar as fotos do primeiro dia" é ação; "Começar a cuidar da alimentação" é intenção. Se a ação não diz o que fazer, ela não serve.',
  '- Etapa é um degrau com nome próprio, não um rótulo de tempo. "Saber de onde você parte" é etapa; "Fase 1" e "Entrar no ritmo" servem pra qualquer objetivo do mundo, ou seja, pra nenhum.',
  '- Os pesos dizem onde está o trabalho. Etapa de preparação vale pouco; a que sustenta o resultado vale muito. Pesos iguais são a resposta de quem não olhou o assunto.',
  '- Cada ação tem versão mínima (minimalVersion), e ela é o que segura o dia ruim: uma versão menor de verdade, não a mesma coisa com outras palavras.',
  '- NENHUMA prescrição de saúde, dieta, treino ou finanças. Nada de caloria, macro, carga em quilo, hora de sono como meta ou onde investir. Você organiza COMPORTAMENTO: aparecer, registrar, medir, rever, preparar. Quando o assunto encosta em saúde ou dinheiro, diga em warnings que o app organiza a rotina e que o resto é com profissional.',
  '- O tempo declarado é teto, nunca meta. Uma ação pontual pode levar mais que o dia (um simulado leva duas horas), mas hábito diário nunca passa do teto.',
  '- Leve em conta o que a pessoa já tem: não repita hábito que ela já cumpre, e não encha um dia que já está cheio.',
].join('\n')

/**
 * O roteiro da biblioteca, quando existe um pro assunto.
 *
 * A IA não começa do zero em assunto conhecido. O trabalho dela passa a ser
 * personalizar: cortar o que não serve pra esta pessoa, acrescentar o que o
 * objetivo escrito pede, ajustar ao que ela já faz. Sem isso o modelo
 * reinventava a estrutura a cada chamada e às vezes devolvia algo pior que o
 * plano determinístico, gastando o raciocínio no que já estava resolvido.
 */
function renderBaseline(baseline: AiPlanRequest['baseline']): string {
  if (!baseline) {
    return [
      'ROTEIRO BASE',
      'Não existe roteiro pronto pra esse assunto. Monte do zero, e traga o que o assunto exige.',
    ].join('\n')
  }

  return [
    `ROTEIRO BASE ("${baseline.label}", montado pelo app)`,
    'Use como ponto de partida: mantenha o que serve, troque o que não serve PRA ESTA PESSOA e acrescente o que o objetivo escrito e o contexto dela pedem. Não copie sem olhar, e não jogue fora sem motivo.',
    ...baseline.steps.map((step) => `- Etapa "${step.title}": ${step.description}`),
    baseline.habits.length > 0 ? `- Hábitos: ${baseline.habits.join('; ')}` : null,
    baseline.tasks.length > 0 ? `- Ações: ${baseline.tasks.join('; ')}` : null,
    baseline.caution ? `- Limite a repassar em warnings: ${baseline.caution}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
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
        PLAN_RULES,
        '',
        renderBaseline(request.baseline),
        '',
        'FORMATO',
        'steps: de 3 a 5 etapas em ordem, cada uma com title (o degrau, não "Etapa 1"), description (o que acontece nela e por quê) e weight (quanto ela vale do objetivo, em porcentagem). Os pesos não precisam somar 100 exatamente; a proporção entre eles é o que importa.',
        'habits: até 4, o que se repete. target e minimalTarget na unidade da área. Nenhum hábito pode pedir mais que o teto diário.',
        'tasks: de 4 a 16 ações concretas, cada uma dentro de uma etapa (stepIndex é a posição em steps, começando em 0). Pelo menos uma é para hoje. Datas AAAA-MM-DD dentro do prazo, e não amontoe várias ações pesadas no mesmo dia.',
        'suggestedDeadline: o prazo pedido, ou um realista quando o alvo não cabe (e aí diga em warnings). reasoning: uma frase sobre a lógica do plano, não motivação.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ]
        .filter((line): line is string => line !== null)
        .join('\n')
    }

    case 'day': {
      const { request } = endpointRequest
      return [
        'Reorganize o dia de hoje pra caber no tempo que a pessoa tem.',
        '',
        `Tempo disponível hoje: ${request.availableMin} minutos (teto). Planejado: ${request.plannedMin} minutos.`,
        '',
        ADJUSTMENT_RULES,
        'Regras do dia: ação atrasada NÃO vem pra hoje se o dia já não cabe. Ação reagendada vai pro primeiro dia dos próximos 7 que ainda tem espaço, dentro do prazo do objetivo dela. Hábito não muda de data. A prioridade principal encolhe (shrink_action) mas não sai do dia. Prefira poucos ajustes: o menor conjunto que faz o dia caber.',
        'summary: uma frase com planejado contra disponível, em minutos. fits: true se depois dos ajustes o dia cabe. reasoning: a lógica da escolha em uma frase. Se o dia já cabe, devolva adjustments vazio e diga isso no summary.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ].join('\n')
    }

    case 'progress':
      return [
        'Leia o progresso dessa pessoa e diga o que os dados mostram.',
        '',
        'summary: uma frase com o estado do ritmo, citando o número que sustenta. patterns: até 4 padrões, cada um com o dado de onde saiu (queda de constância, adiamento repetido, dia sempre maior que a capacidade, horário que rende). bottlenecks: o que está travando o plano (etapa, ação atrasada, fator fraco). overload: só se o dia pede mais do que a capacidade comporta; senão null. stalled: títulos exatos dos objetivos parados. adjustments: de 1 a 4 ajustes concretos e pequenos, aplicáveis esta semana, em prosa. nextAction: a única coisa a fazer agora, em uma frase.',
        'proposals: até 4 dos ajustes acima que dá pra aplicar com um toque, no formato estruturado. Prazo, frequência de hábito, duração ou ordem das ações. Só o que os dados sustentam; sem dado, lista vazia.',
        ADJUSTMENT_RULES,
        'Se houver review anterior com ajuste decidido, confira se ele aconteceu e diga.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ].join('\n')

    case 'review_draft': {
      const { request } = endpointRequest
      const w = request.written
      return [
        `Prepare o review da semana ${request.weekLabel} a partir dos dados. A pessoa vai ler, corrigir e confirmar: escreva na primeira pessoa, como se fosse ela contando, curto e sem elogio.`,
        '',
        `Execução: ${Math.round(request.executionRate * 100)}% do planejado; ações ${request.tasksDone}/${request.tasksPlanned}; hábitos ${request.habitsDone}/${request.habitsPlanned}; ${request.activeDays} dias ativos; ${request.focusMinutes} minutos de foco.`,
        w.achievements ? `Ela já escreveu em conquistas: ${w.achievements}` : null,
        w.difficulties ? `Já escreveu em dificuldades: ${w.difficulties}` : null,
        w.learnings ? `Já escreveu em aprendizados: ${w.learnings}` : null,
        w.adjustments ? `Já escreveu em ajustes: ${w.adjustments}` : null,
        '',
        'achievements: o que saiu de verdade, com número. difficulties: onde a execução caiu e o que os dados mostram sobre o porquê (adiamento, dia cheio, etapa travada), sem diagnóstico. learnings: um padrão sobre como ela funciona, tirado dos dados. adjustments: o que muda na semana que vem, concreto. priorities: de 1 a 3 itens curtos pra próxima semana, tirados das próximas ações e gargalos. basis: uma frase listando os números que você usou. O que ela já escreveu você preserva e completa, nunca substitui.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ]
        .filter((line): line is string => line !== null)
        .join('\n')
    }

    case 'recovery': {
      const { request } = endpointRequest
      return [
        'A pessoa parou por alguns dias e o app ligou o Modo Retomada. Monte o plano de volta.',
        '',
        `Sinais que ligaram o modo: ${request.signals.join('; ')}. Último movimento há ${request.daysSinceLastMove} dias.`,
        '',
        'opening: até 3 frases lendo o que aconteceu pelos dados, sem contar dias perdidos, sem culpa, sem "não desista" e sem cobrança. Diga o que continua de pé (sequência recorde, etapas fechadas, o que já andou).',
        'adjustments: de 1 a 3 passos PEQUENOS pra hoje, ordenados por avanço por minuto e não por importância: trazer uma ação atrasada (move_action pra hoje), encolher pra versão mínima (shrink_action) ou criar uma ação curta (create_action, no máximo 30 minutos, com minimalVersion). Um passo por objetivo. O primeiro vira a prioridade principal (set_main_priority não é necessário: o app faz isso).',
        'keepHabits: até 3 refs de hábitos que valem manter na versão mínima esta semana, os de maior constância primeiro. reasoning: por que esses passos e não os maiores.',
        ADJUSTMENT_RULES,
        '',
        'CONTEXTO DA CONTA',
        context,
      ].join('\n')
    }

    case 'coach': {
      const { request } = endpointRequest
      return [
        'Você é o coach da pessoa, no fim da tela de métricas. Tom: AGRESSIVO e exigente, como um treinador que não aceita desculpa. Isso significa direto, seco, cobrando com número. NUNCA significa ofensa pessoal, xingamento, humilhação, ameaça ou comentário sobre corpo, saúde mental ou vida pessoal. Sem "você consegue", sem "parabéns", sem "continue assim", sem exclamação em série.',
        '',
        `Números de agora: Momentumm ${request.momentum}/100 (${request.momentumLevel}); XP desta semana ${request.weekXp} contra ${request.previousWeekXp} na anterior; nível ${request.level} (${request.levelName}), faltam ${request.xpToNext} XP pro próximo; sequência de ${request.streak} dias (recorde ${request.streakRecord}); ${request.activeDays} de ${request.windowDays} dias com movimento; ${request.overdueTasks} ações atrasadas; objetivos parados: ${request.stalledObjectives.length > 0 ? request.stalledObjectives.join('; ') : 'nenhum'}; próxima ação sugerida: ${request.nextAction ?? 'nenhuma'}.`,
        '',
        'punch: uma frase de impacto, até 12 palavras, segunda pessoa, sem número. truth: a verdade desconfortável que os números mostram, em até 2 frases, citando pelo menos um número de cima (o mais incômodo). Se a semana está melhor que a anterior, diga que ainda é pouco pra onde ela quer chegar, com o XP que falta. order: UMA ordem concreta pra hoje, começando com verbo no imperativo, usando a próxima ação sugerida ou a ação atrasada mais antiga quando existir. Nada de travessão no texto.',
        '',
        'CONTEXTO DA CONTA',
        context,
      ].join('\n')
    }

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

const ADJUSTMENT_RULES = [
  'Tipos de ajuste e o que cada um pede:',
  '- move_action {ref, toDay}: muda a data de uma ação (ref a#). toDay em AAAA-MM-DD, nunca no passado.',
  '- shrink_action {ref}: a ação vira a versão mínima dela. Só pra ação que tem "mínima" no contexto.',
  '- set_minutes {ref, estimatedMin}: muda a duração estimada da ação.',
  '- set_main_priority {ref}: essa ação vira a prioridade principal de hoje. No máximo uma.',
  '- extend_deadline {ref, toDay}: adia o prazo de um objetivo (ref o#). Só quando a previsão mostra que o prazo atual não fecha no ritmo real.',
  '- change_habit_frequency {ref, timesPerWeek, weekdays}: muda a frequência de um hábito (ref h#). weekdays com 0=domingo a 6=sábado, vazio quando não há dia fixo.',
  '- create_action {title, day, estimatedMin, minimalVersion, objectiveRef}: cria uma ação nova, curta, dentro de um objetivo (ref o#) ou null.',
  'Todo ajuste tem reason: uma frase com o dado que o motivou. Use só refs que aparecem no contexto.',
].join('\n')

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
