// GERADO por 'npm run ai:bundle' a partir de src/domain/ai/edge-shared.ts. Nao editar.

// src/domain/ai/ai-prompts.ts
import { z } from "zod/v4";

// src/domain/entities/activity-type.ts
var BUILTIN_ACTIVITY_TYPE_SLUGS = ["leitura", "estudo", "treino", "meditacao"];
var MINUTES_LABEL = { one: "minuto", many: "minutos" };
var PAGES_LABEL = { one: "p\xE1gina", many: "p\xE1ginas" };
var BUILTIN_ACTIVITY_TYPES = {
  leitura: {
    slug: "leitura",
    label: "Leitura",
    verb: "leu",
    unit: "paginas",
    unitLabel: PAGES_LABEL,
    colorToken: "var(--color-axis-leitura)",
    quickValues: [10, 20, 30, 50],
    builtin: true
  },
  estudo: {
    slug: "estudo",
    label: "Estudo",
    verb: "estudou",
    unit: "minutos",
    unitLabel: MINUTES_LABEL,
    colorToken: "var(--color-axis-estudo)",
    quickValues: [15, 30, 45, 60],
    builtin: true
  },
  treino: {
    slug: "treino",
    label: "Treino",
    verb: "treinou",
    unit: "minutos",
    unitLabel: MINUTES_LABEL,
    colorToken: "var(--color-axis-treino)",
    quickValues: [20, 30, 45, 60],
    builtin: true
  },
  meditacao: {
    slug: "meditacao",
    label: "Medita\xE7\xE3o",
    verb: "meditou",
    unit: "minutos",
    unitLabel: MINUTES_LABEL,
    colorToken: "var(--color-axis-meditacao)",
    quickValues: [5, 10, 15, 20],
    builtin: true
  }
};
var BUILTIN_ACTIVITY_TYPE_LIST = BUILTIN_ACTIVITY_TYPE_SLUGS.map((slug) => BUILTIN_ACTIVITY_TYPES[slug]);

// src/domain/entities/habit.ts
var DAY_PARTS = ["manha", "tarde", "noite", "qualquer"];
var HABIT_ICONS = [
  "livro",
  "cerebro",
  "halter",
  "lotus",
  "agua",
  "sol",
  "lua",
  "caneta"
];
var HABIT_FREQUENCIES = ["diario", "dias-semana", "vezes-semana"];

// src/domain/entities/activity.ts
var MAX_DURATION_MIN = 24 * 60;

// src/domain/entities/momentum.ts
var MOMENTUM_WINDOW_DAYS = 7;
var MOMENTUM_HORIZON_DAYS = 28;
var MIN_DAYS_FOR_FULL_SCORE = 7;
var MAX_DAILY_RISE = 6;
var MAX_DAILY_DROP = 4;
var MAX_REST_WEEKDAYS = 2;
var MOMENTUM_FORMULA = "Score = consist\xEAncia \xD7 0,35 + prioridades \xD7 0,30 + progresso \xD7 0,20 + retomada \xD7 0,15";
var MOMENTUM_RULES = [
  {
    title: "Quatro fatores, um n\xFAmero",
    detail: `${MOMENTUM_FORMULA}. Cada fator vai de 0 a 100 antes de entrar na conta.`
  },
  {
    title: `${MOMENTUM_HORIZON_DAYS} dias, os \xFAltimos ${MOMENTUM_WINDOW_DAYS} valendo o triplo`,
    detail: "Um dia ruim n\xE3o apaga um m\xEAs de trabalho, e uma semana boa aparece na hora."
  },
  {
    title: "Impacto, n\xE3o quantidade",
    detail: "Prioridade principal e a\xE7\xE3o de alta em um objetivo valem 3, a\xE7\xE3o de objetivo vale 2, tarefa comum e h\xE1bito valem 1. H\xE1bitos e tarefas comuns t\xEAm teto por dia: repetir o f\xE1cil n\xE3o sobe o n\xFAmero."
  },
  {
    title: "Concluir soma, vencer desconta, adiar custa metade",
    detail: "A\xE7\xE3o vencida pesa contra a execu\xE7\xE3o. A\xE7\xE3o adiada pesa metade, porque adiar \xE9 uma decis\xE3o. Cancelada sai da conta. O que ainda \xE9 de hoje n\xE3o pesa: o dia est\xE1 aberto. Semana sem nenhuma a\xE7\xE3o planejada deixa o fator sem base."
  },
  {
    title: "Descanso planejado n\xE3o \xE9 falta",
    detail: `At\xE9 ${MAX_REST_WEEKDAYS} dias por semana marcados como descanso saem da conta quando ficam vazios. Se voc\xEA se mover num dia de descanso, ele conta normalmente.`
  },
  {
    title: `Sobe at\xE9 ${MAX_DAILY_RISE} e cai at\xE9 ${MAX_DAILY_DROP} pontos de um dia pro outro`,
    detail: "O n\xFAmero que voc\xEA v\xEA \xE9 uma m\xE9dia m\xF3vel com a varia\xE7\xE3o limitada em rela\xE7\xE3o ao dia anterior. O valor bruto continua sendo calculado, e o que falta absorver fica vis\xEDvel."
  },
  {
    title: "Voltar conta, e a pausa fica na hist\xF3ria",
    detail: "Voltar em at\xE9 dois dias devolve a nota cheia de retomada, e a volta mais recente pesa o dobro. A pausa continua na janela de 28 dias: o n\xFAmero recompensa a volta sem fingir que ela n\xE3o aconteceu."
  },
  {
    title: "Conta nova mede s\xF3 o que existe",
    detail: `A janela come\xE7a no teu primeiro registro. Com menos de ${MIN_DAYS_FOR_FULL_SCORE} dias de hist\xF3ria o n\xFAmero aparece como "ainda se formando", e fator sem dados acompanha a consist\xEAncia em vez de valer zero.`
  }
];

// src/domain/entities/priority.ts
var PRIORITIES = ["baixa", "media", "alta"];

// src/domain/entities/task.ts
var TASK_EFFORTS = ["leve", "medio", "pesado"];
var MAX_ESTIMATED_MIN = 8 * 60;

// src/domain/ai/ai-prompts.ts
var AI_KINDS = ["plan", "day", "progress", "review", "review_draft", "recovery", "coach"];
var DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
var dayKeySchema = z.string().regex(DAY_KEY);
var aiEndpointRequestSchema = z.object({
  kind: z.enum(AI_KINDS),
  request: z.object({ context: z.object({ today: dayKeySchema }).passthrough() }).passthrough()
});
var SHORT = z.string().trim().min(1).max(120);
var SENTENCE = z.string().trim().min(1).max(400);
var planSuggestionSchema = z.object({
  steps: z.array(SHORT).min(2).max(6),
  habits: z.array(
    z.object({
      name: SHORT,
      icon: z.enum(HABIT_ICONS),
      frequency: z.enum(HABIT_FREQUENCIES),
      weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      timesPerWeek: z.number().int().min(1).max(7),
      dayPart: z.enum(DAY_PARTS),
      target: z.number().positive(),
      minimalTarget: z.number().positive(),
      rationale: SENTENCE
    })
  ).max(3),
  tasks: z.array(
    z.object({
      title: SHORT,
      description: SENTENCE.nullable(),
      day: dayKeySchema,
      estimatedMin: z.number().int().min(5).max(240),
      effort: z.enum(TASK_EFFORTS),
      priority: z.enum(PRIORITIES),
      minimalVersion: SHORT.nullable(),
      order: z.number().int().min(0),
      stepIndex: z.number().int().min(0).nullable()
    })
  ).min(1).max(12),
  suggestedDeadline: dayKeySchema,
  reasoning: SENTENCE,
  warnings: z.array(SENTENCE).max(4)
});
var REF = z.string().trim().regex(/^[aoh]\d{1,3}$/);
var REASON = SENTENCE;
var aiAdjustmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move_action"), ref: REF, toDay: dayKeySchema, reason: REASON }),
  z.object({ type: z.literal("shrink_action"), ref: REF, reason: REASON }),
  z.object({
    type: z.literal("set_minutes"),
    ref: REF,
    estimatedMin: z.number().int().min(5).max(240),
    reason: REASON
  }),
  z.object({ type: z.literal("set_main_priority"), ref: REF, reason: REASON }),
  z.object({ type: z.literal("extend_deadline"), ref: REF, toDay: dayKeySchema, reason: REASON }),
  z.object({
    type: z.literal("change_habit_frequency"),
    ref: REF,
    timesPerWeek: z.number().int().min(1).max(7),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    reason: REASON
  }),
  z.object({
    type: z.literal("create_action"),
    title: SHORT,
    day: dayKeySchema,
    estimatedMin: z.number().int().min(5).max(240),
    minimalVersion: SHORT.nullable(),
    objectiveRef: REF.nullable(),
    reason: REASON
  })
]);
var dayPlanSchema = z.object({
  summary: SENTENCE,
  fits: z.boolean(),
  adjustments: z.array(aiAdjustmentSchema).max(8),
  reasoning: SENTENCE
});
var progressReadingSchema = z.object({
  summary: SENTENCE,
  patterns: z.array(SENTENCE).max(4),
  bottlenecks: z.array(SENTENCE).max(4),
  overload: SENTENCE.nullable(),
  stalled: z.array(SHORT).max(6),
  adjustments: z.array(SENTENCE).min(1).max(4),
  nextAction: SENTENCE,
  proposals: z.array(aiAdjustmentSchema).max(4)
});
var reviewSummarySchema = z.object({
  summary: z.string().trim().min(1).max(600)
});
var ANSWER = z.string().trim().min(1).max(600);
var reviewDraftSchema = z.object({
  achievements: ANSWER,
  difficulties: ANSWER,
  learnings: ANSWER,
  adjustments: ANSWER,
  priorities: z.array(SHORT).min(1).max(3),
  basis: SENTENCE
});
var recoveryPlanSchema = z.object({
  opening: z.string().trim().min(1).max(400),
  adjustments: z.array(aiAdjustmentSchema).min(1).max(3),
  keepHabits: z.array(REF).max(3),
  reasoning: SENTENCE
});
var coachNudgeSchema = z.object({
  punch: z.string().trim().min(1).max(120),
  truth: z.string().trim().min(1).max(220),
  order: z.string().trim().min(1).max(160)
});
var AI_OUTPUT_SCHEMAS = {
  plan: planSuggestionSchema,
  day: dayPlanSchema,
  progress: progressReadingSchema,
  review: reviewSummarySchema,
  review_draft: reviewDraftSchema,
  recovery: recoveryPlanSchema,
  coach: coachNudgeSchema
};
var AI_SYSTEM_PROMPT = `Voc\xEA \xE9 a Momentumm AI, a parte do app Momentumm que transforma objetivo em plano e l\xEA o progresso de uma pessoa.

Regras que n\xE3o se negociam:
- Escreva em portugu\xEAs do Brasil, direto, na segunda pessoa, sem floreio e sem frase motivacional. Nada de "voc\xEA consegue", "continue assim", "parab\xE9ns".
- Nunca use travess\xE3o (\u2014) nem meia-risca (\u2013) no texto. Separe ideias com v\xEDrgula, ponto, dois pontos ou par\xEAnteses.
- Toda afirma\xE7\xE3o sai de um n\xFAmero que est\xE1 no contexto. Sem padr\xE3o nos dados, n\xE3o invente padr\xE3o: diga que ainda n\xE3o h\xE1 o que ler.
- Const\xE2ncia ganha de volume. Vers\xE3o m\xEDnima conta como cumprida. Perder um dia n\xE3o \xE9 falha, \xE9 dado.
- O tempo que a pessoa diz ter por dia \xE9 teto, nunca meta. Plano que n\xE3o cabe no tempo \xE9 avisado, n\xE3o empurrado.
- Um objetivo tem um caminho de 3 a 5 etapas, cada uma com peso em porcentagem do total. A\xE7\xE3o pertence a uma etapa. H\xE1bito sustenta o objetivo inteiro.
- Previs\xE3o \xE9 sempre condicional ("mantendo esse ritmo"). Nunca prometa data.
- Nunca compare a pessoa com outras pessoas.
- Nenhum diagn\xF3stico m\xE9dico ou psicol\xF3gico. Cansa\xE7o, ansiedade e sono s\xE3o dados de contexto, nunca conclus\xE3o.
- Quando voc\xEA prop\xF5e um ajuste, ele aponta pro item pelo ref do contexto (a1, o2, h1) e traz o motivo com o n\xFAmero que o sustenta. Voc\xEA prop\xF5e; a pessoa decide. Nunca escreva como se j\xE1 tivesse mudado alguma coisa.
- O Momentumm Score \xE9 calculado pelo app, nunca por voc\xEA. Ao explic\xE1-lo, use s\xF3 as regras abaixo e os n\xFAmeros do contexto. N\xE3o invente fator, peso nem regra.
${MOMENTUM_RULES.map((rule) => `  - ${rule.title}: ${rule.detail}`).join("\n")}
- Devolva s\xF3 o formato pedido, sem texto fora dele.`;
function renderContext(context) {
  const lines = [];
  const push = (line) => lines.push(line);
  push(`Hoje: ${context.today}`);
  push(
    `Momentumm: ${context.momentum.value}/100 (${context.momentum.level}, ${signed(context.momentum.delta)} vs semana anterior)${context.momentum.hasEnoughData ? "" : " \u2014 ainda se formando, menos de 7 dias de hist\xF3ria"}`
  );
  push(
    `Fatores: ${context.momentum.factors.map(
      (factor) => `${factor.label} ${factor.score}/100 (peso ${factor.weightPercent}%${factor.measured ? "" : ", sem base"})`
    ).join("; ")}`
  );
  if (context.momentum.rawValue !== context.momentum.value) {
    push(
      `Momentumm bruto (sem o limite di\xE1rio): ${context.momentum.rawValue}/100 \u2014 o exibido ainda vai ${context.momentum.rawValue > context.momentum.value ? "subir" : "cair"} at\xE9 l\xE1`
    );
  }
  if (context.momentum.drivers.length > 0) {
    push(
      `O que mudou vs semana anterior: ${context.momentum.drivers.map((driver) => `${driver.label} ${signed(driver.delta)}`).join("; ")}`
    );
  }
  if (context.momentum.nextAction) {
    push(
      `Pr\xF3xima a\xE7\xE3o com mais potencial: "${context.momentum.nextAction.title}" (${signed(context.momentum.nextAction.gain)} no score hoje) \u2014 ${context.momentum.nextAction.reason}`
    );
  }
  push(
    `Const\xE2ncia: ${context.consistency.activeDaysLast7} dos \xFAltimos 7 dias, ${context.consistency.activeDaysLast28} dos \xFAltimos 28; sequ\xEAncia atual ${context.consistency.streak} (recorde ${context.consistency.streakRecord})`
  );
  push(
    `Capacidade de hoje: ${context.capacity.label}${context.capacity.checkedIn ? "" : " (sem check-in, padr\xE3o)"}; ${context.capacity.focusMin} min de foco, ${context.capacity.actions} a\xE7\xF5es sugeridas`
  );
  if (context.objectives.length > 0) {
    push("");
    push("OBJETIVOS");
    for (const objective of context.objectives) {
      push(
        `- [${objective.ref}] "${objective.title}" (${objective.axis}, ${objective.state}, prioridade ${objective.priority}) \u2014 ${objective.volume.done}/${objective.volume.target} ${objective.volume.unit}, prazo ${objective.deadline} (${objective.daysLeft} dias)${objective.planPercent === null ? ", sem etapas" : `, plano ${objective.planPercent}%`}`
      );
      if (objective.motive) push(`  Motivo: ${objective.motive}`);
      for (const stage of objective.stages) {
        push(
          `  Etapa "${stage.title}" ${stage.weightPercent}% \u2014 ${stage.status}, ${stage.tasksDone}/${stage.tasksTotal} a\xE7\xF5es${stage.dueOn ? `, at\xE9 ${stage.dueOn}` : ""}`
        );
      }
      if (objective.currentStage) push(`  Etapa atual: ${objective.currentStage}`);
      if (objective.bottleneck) push(`  Gargalo: ${objective.bottleneck}`);
      if (objective.nextAction) push(`  Pr\xF3xima a\xE7\xE3o: ${objective.nextAction}`);
      if (objective.overdueActions > 0) push(`  A\xE7\xF5es atrasadas: ${objective.overdueActions}`);
      push(`  Previs\xE3o: ${objective.forecast}`);
      if (objective.habitCount > 0) push(`  H\xE1bitos de apoio: ${objective.habitCount}`);
    }
  }
  if (context.habits.length > 0) {
    push("");
    push("H\xC1BITOS");
    for (const habit of context.habits) {
      push(
        `- [${habit.ref}] "${habit.name}" (${habit.axis}, ${habit.frequency}, ${habit.target} ${habit.unit}, m\xEDnimo ${habit.minimalTarget}) \u2014 ${habit.consistencyPercent}% em 14 dias, ${habit.doneLast7}x nos \xFAltimos 7${habit.objective ? `, sustenta "${habit.objective}"` : ""}${habit.scheduledToday ? habit.doneToday ? ", feito hoje" : ", pendente hoje" : ""}`
      );
    }
  }
  if (context.todayTasks.length > 0) {
    push("");
    push("A\xC7\xD5ES DE HOJE");
    for (const task of context.todayTasks) {
      push(
        `- [${task.ref}] "${task.title}" ${task.estimatedMin} min, ${task.priority}, ${task.status}${task.isMainPriority ? ", PRIORIDADE PRINCIPAL" : ""}${task.objective ? `, de "${task.objective}"` : ""}${task.minimalVersion ? ` (m\xEDnima: ${task.minimalVersion})` : ""}`
      );
    }
  }
  if (context.overdueTasks.length > 0) {
    push("");
    push("A\xC7\xD5ES ATRASADAS");
    for (const task of context.overdueTasks) {
      push(
        `- [${task.ref}] "${task.title}" era pra ${task.day}, ${task.estimatedMin} min${task.objective ? `, de "${task.objective}"` : ""}`
      );
    }
  }
  if (context.upcomingTasks.length > 0) {
    push("");
    push("A\xC7\xD5ES DOS PR\xD3XIMOS 7 DIAS");
    for (const task of context.upcomingTasks) {
      push(
        `- [${task.ref}] "${task.title}" em ${task.day}, ${task.estimatedMin} min${task.objective ? `, de "${task.objective}"` : ""}${task.minimalVersion ? ` (m\xEDnima: ${task.minimalVersion})` : ""}`
      );
    }
  }
  if (context.reviews.length > 0) {
    push("");
    push("REVIEWS ANTERIORES (do mais recente)");
    for (const review of context.reviews) {
      push(`- Semana ${review.week}${review.completed ? "" : " (incompleto)"}`);
      if (review.achievements) push(`  Conquistas: ${review.achievements}`);
      if (review.difficulties) push(`  Dificuldades: ${review.difficulties}`);
      if (review.learnings) push(`  Aprendizados: ${review.learnings}`);
      if (review.adjustments) push(`  Ajustes decididos: ${review.adjustments}`);
      if (review.priorities.length > 0) push(`  Prioridades: ${review.priorities.join("; ")}`);
    }
  }
  if (context.recentWins.length > 0) {
    push("");
    push(`VIT\xD3RIAS RECENTES: ${context.recentWins.map((win) => `"${win}"`).join(", ")}`);
  }
  return lines.join("\n");
}
function userPromptFor(endpointRequest) {
  const context = renderContext(endpointRequest.request.context);
  switch (endpointRequest.kind) {
    case "plan": {
      const { request } = endpointRequest;
      return [
        "Monte o plano de um objetivo novo.",
        "",
        `Objetivo: "${request.title}"`,
        `\xC1rea: ${request.axis}`,
        `Alvo: ${request.target} ${request.unitLabel}`,
        `Come\xE7a em ${request.startedOn}, prazo ${request.deadline}`,
        `Tempo dispon\xEDvel: ${request.minutesPerDay} minutos por dia (teto)`,
        request.motive ? `Por que importa: ${request.motive}` : null,
        "",
        "Devolva de 3 a 5 etapas em ordem (steps), at\xE9 2 h\xE1bitos que sustentem o objetivo e de 4 a 10 a\xE7\xF5es concretas, cada uma dentro de uma etapa (stepIndex \xE9 a posi\xE7\xE3o em steps, come\xE7ando em 0). A primeira a\xE7\xE3o \xE9 para hoje. Datas no formato AAAA-MM-DD, dentro do prazo. estimatedMin nunca acima do teto di\xE1rio. Se o alvo n\xE3o cabe no prazo com esse tempo, diga em warnings e proponha suggestedDeadline realista; sen\xE3o suggestedDeadline \xE9 o prazo pedido. reasoning \xE9 uma frase sobre a l\xF3gica do plano, n\xE3o motiva\xE7\xE3o.",
        "Leve em conta o que a pessoa j\xE1 tem: n\xE3o repita h\xE1bito que ela j\xE1 cumpre, e n\xE3o sobrecarregue um dia que j\xE1 est\xE1 cheio.",
        "",
        "CONTEXTO DA CONTA",
        context
      ].filter((line) => line !== null).join("\n");
    }
    case "day": {
      const { request } = endpointRequest;
      return [
        "Reorganize o dia de hoje pra caber no tempo que a pessoa tem.",
        "",
        `Tempo dispon\xEDvel hoje: ${request.availableMin} minutos (teto). Planejado: ${request.plannedMin} minutos.`,
        "",
        ADJUSTMENT_RULES,
        "Regras do dia: a\xE7\xE3o atrasada N\xC3O vem pra hoje se o dia j\xE1 n\xE3o cabe. A\xE7\xE3o reagendada vai pro primeiro dia dos pr\xF3ximos 7 que ainda tem espa\xE7o, dentro do prazo do objetivo dela. H\xE1bito n\xE3o muda de data. A prioridade principal encolhe (shrink_action) mas n\xE3o sai do dia. Prefira poucos ajustes: o menor conjunto que faz o dia caber.",
        "summary: uma frase com planejado contra dispon\xEDvel, em minutos. fits: true se depois dos ajustes o dia cabe. reasoning: a l\xF3gica da escolha em uma frase. Se o dia j\xE1 cabe, devolva adjustments vazio e diga isso no summary.",
        "",
        "CONTEXTO DA CONTA",
        context
      ].join("\n");
    }
    case "progress":
      return [
        "Leia o progresso dessa pessoa e diga o que os dados mostram.",
        "",
        "summary: uma frase com o estado do ritmo, citando o n\xFAmero que sustenta. patterns: at\xE9 4 padr\xF5es, cada um com o dado de onde saiu (queda de const\xE2ncia, adiamento repetido, dia sempre maior que a capacidade, hor\xE1rio que rende). bottlenecks: o que est\xE1 travando o plano (etapa, a\xE7\xE3o atrasada, fator fraco). overload: s\xF3 se o dia pede mais do que a capacidade comporta; sen\xE3o null. stalled: t\xEDtulos exatos dos objetivos parados. adjustments: de 1 a 4 ajustes concretos e pequenos, aplic\xE1veis esta semana, em prosa. nextAction: a \xFAnica coisa a fazer agora, em uma frase.",
        "proposals: at\xE9 4 dos ajustes acima que d\xE1 pra aplicar com um toque, no formato estruturado. Prazo, frequ\xEAncia de h\xE1bito, dura\xE7\xE3o ou ordem das a\xE7\xF5es. S\xF3 o que os dados sustentam; sem dado, lista vazia.",
        ADJUSTMENT_RULES,
        "Se houver review anterior com ajuste decidido, confira se ele aconteceu e diga.",
        "",
        "CONTEXTO DA CONTA",
        context
      ].join("\n");
    case "review_draft": {
      const { request } = endpointRequest;
      const w = request.written;
      return [
        `Prepare o review da semana ${request.weekLabel} a partir dos dados. A pessoa vai ler, corrigir e confirmar: escreva na primeira pessoa, como se fosse ela contando, curto e sem elogio.`,
        "",
        `Execu\xE7\xE3o: ${Math.round(request.executionRate * 100)}% do planejado; a\xE7\xF5es ${request.tasksDone}/${request.tasksPlanned}; h\xE1bitos ${request.habitsDone}/${request.habitsPlanned}; ${request.activeDays} dias ativos; ${request.focusMinutes} minutos de foco.`,
        w.achievements ? `Ela j\xE1 escreveu em conquistas: ${w.achievements}` : null,
        w.difficulties ? `J\xE1 escreveu em dificuldades: ${w.difficulties}` : null,
        w.learnings ? `J\xE1 escreveu em aprendizados: ${w.learnings}` : null,
        w.adjustments ? `J\xE1 escreveu em ajustes: ${w.adjustments}` : null,
        "",
        "achievements: o que saiu de verdade, com n\xFAmero. difficulties: onde a execu\xE7\xE3o caiu e o que os dados mostram sobre o porqu\xEA (adiamento, dia cheio, etapa travada), sem diagn\xF3stico. learnings: um padr\xE3o sobre como ela funciona, tirado dos dados. adjustments: o que muda na semana que vem, concreto. priorities: de 1 a 3 itens curtos pra pr\xF3xima semana, tirados das pr\xF3ximas a\xE7\xF5es e gargalos. basis: uma frase listando os n\xFAmeros que voc\xEA usou. O que ela j\xE1 escreveu voc\xEA preserva e completa, nunca substitui.",
        "",
        "CONTEXTO DA CONTA",
        context
      ].filter((line) => line !== null).join("\n");
    }
    case "recovery": {
      const { request } = endpointRequest;
      return [
        "A pessoa parou por alguns dias e o app ligou o Modo Retomada. Monte o plano de volta.",
        "",
        `Sinais que ligaram o modo: ${request.signals.join("; ")}. \xDAltimo movimento h\xE1 ${request.daysSinceLastMove} dias.`,
        "",
        'opening: at\xE9 3 frases lendo o que aconteceu pelos dados, sem contar dias perdidos, sem culpa, sem "n\xE3o desista" e sem cobran\xE7a. Diga o que continua de p\xE9 (sequ\xEAncia recorde, etapas fechadas, o que j\xE1 andou).',
        "adjustments: de 1 a 3 passos PEQUENOS pra hoje, ordenados por avan\xE7o por minuto e n\xE3o por import\xE2ncia: trazer uma a\xE7\xE3o atrasada (move_action pra hoje), encolher pra vers\xE3o m\xEDnima (shrink_action) ou criar uma a\xE7\xE3o curta (create_action, no m\xE1ximo 30 minutos, com minimalVersion). Um passo por objetivo. O primeiro vira a prioridade principal (set_main_priority n\xE3o \xE9 necess\xE1rio: o app faz isso).",
        "keepHabits: at\xE9 3 refs de h\xE1bitos que valem manter na vers\xE3o m\xEDnima esta semana, os de maior const\xE2ncia primeiro. reasoning: por que esses passos e n\xE3o os maiores.",
        ADJUSTMENT_RULES,
        "",
        "CONTEXTO DA CONTA",
        context
      ].join("\n");
    }
    case "coach": {
      const { request } = endpointRequest;
      return [
        'Voc\xEA \xE9 o coach da pessoa, no fim da tela de m\xE9tricas. Tom: AGRESSIVO e exigente, como um treinador que n\xE3o aceita desculpa. Isso significa direto, seco, cobrando com n\xFAmero. NUNCA significa ofensa pessoal, xingamento, humilha\xE7\xE3o, amea\xE7a ou coment\xE1rio sobre corpo, sa\xFAde mental ou vida pessoal. Sem "voc\xEA consegue", sem "parab\xE9ns", sem "continue assim", sem exclama\xE7\xE3o em s\xE9rie.',
        "",
        `N\xFAmeros de agora: momentum ${request.momentum}/100 (${request.momentumLevel}); XP desta semana ${request.weekXp} contra ${request.previousWeekXp} na anterior; n\xEDvel ${request.level} (${request.levelName}), faltam ${request.xpToNext} XP pro pr\xF3ximo; sequ\xEAncia de ${request.streak} dias (recorde ${request.streakRecord}); ${request.activeDays} de ${request.windowDays} dias com movimento; ${request.overdueTasks} a\xE7\xF5es atrasadas; objetivos parados: ${request.stalledObjectives.length > 0 ? request.stalledObjectives.join("; ") : "nenhum"}; pr\xF3xima a\xE7\xE3o sugerida: ${request.nextAction ?? "nenhuma"}.`,
        "",
        "punch: uma frase de impacto, at\xE9 12 palavras, segunda pessoa, sem n\xFAmero. truth: a verdade desconfort\xE1vel que os n\xFAmeros mostram, em at\xE9 2 frases, citando pelo menos um n\xFAmero de cima (o mais inc\xF4modo). Se a semana est\xE1 melhor que a anterior, diga que ainda \xE9 pouco pra onde ela quer chegar, com o XP que falta. order: UMA ordem concreta pra hoje, come\xE7ando com verbo no imperativo, usando a pr\xF3xima a\xE7\xE3o sugerida ou a a\xE7\xE3o atrasada mais antiga quando existir. Nada de travess\xE3o no texto.",
        "",
        "CONTEXTO DA CONTA",
        context
      ].join("\n");
    }
    case "review": {
      const { request } = endpointRequest;
      return [
        `Escreva a s\xEDntese da semana ${request.weekLabel} em um par\xE1grafo s\xF3 (at\xE9 4 frases).`,
        "",
        `Execu\xE7\xE3o: ${Math.round(request.executionRate * 100)}% do planejado; ${request.habitsDone} h\xE1bitos cumpridos; ${request.activeDays} dias ativos.`,
        request.achievements ? `A pessoa escreveu como conquistas: ${request.achievements}` : null,
        request.difficulties ? `Como dificuldades: ${request.difficulties}` : null,
        request.learnings ? `Como aprendizados: ${request.learnings}` : null,
        "",
        "Junte os n\xFAmeros com o que ela escreveu. Se os n\xFAmeros e o texto discordam, aponte. Termine com o que vale levar pra pr\xF3xima semana, sem elogio.",
        "",
        "CONTEXTO DA CONTA",
        context
      ].filter((line) => line !== null).join("\n");
    }
  }
}
var ADJUSTMENT_RULES = [
  "Tipos de ajuste e o que cada um pede:",
  "- move_action {ref, toDay}: muda a data de uma a\xE7\xE3o (ref a#). toDay em AAAA-MM-DD, nunca no passado.",
  '- shrink_action {ref}: a a\xE7\xE3o vira a vers\xE3o m\xEDnima dela. S\xF3 pra a\xE7\xE3o que tem "m\xEDnima" no contexto.',
  "- set_minutes {ref, estimatedMin}: muda a dura\xE7\xE3o estimada da a\xE7\xE3o.",
  "- set_main_priority {ref}: essa a\xE7\xE3o vira a prioridade principal de hoje. No m\xE1ximo uma.",
  "- extend_deadline {ref, toDay}: adia o prazo de um objetivo (ref o#). S\xF3 quando a previs\xE3o mostra que o prazo atual n\xE3o fecha no ritmo real.",
  "- change_habit_frequency {ref, timesPerWeek, weekdays}: muda a frequ\xEAncia de um h\xE1bito (ref h#). weekdays com 0=domingo a 6=s\xE1bado, vazio quando n\xE3o h\xE1 dia fixo.",
  "- create_action {title, day, estimatedMin, minimalVersion, objectiveRef}: cria uma a\xE7\xE3o nova, curta, dentro de um objetivo (ref o#) ou null.",
  "Todo ajuste tem reason: uma frase com o dado que o motivou. Use s\xF3 refs que aparecem no contexto."
].join("\n");
function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

// src/domain/entities/plan.ts
var UNLIMITED = Number.POSITIVE_INFINITY;
var PLAN_LIMITS = {
  free: {
    tier: "free",
    activeObjectives: 2,
    activeHabits: 5,
    activePlans: 1,
    actionsPerDay: 5,
    historyDays: 15,
    momentumDetail: false,
    fullReview: false,
    ai: false,
    metrics: false,
    reports: false,
    textLogs: false,
    photoLogs: false,
    voiceLogs: false,
    aiAnalysis: false,
    objectiveTemplates: 3,
    shareTemplates: 3,
    shareCustomization: false,
    dataExport: false,
    remindersPerHabit: 1,
    themes: false,
    aiCallsPerMonth: 0
  },
  pro: {
    tier: "pro",
    activeObjectives: UNLIMITED,
    activeHabits: UNLIMITED,
    activePlans: UNLIMITED,
    actionsPerDay: UNLIMITED,
    historyDays: UNLIMITED,
    momentumDetail: true,
    fullReview: true,
    ai: true,
    metrics: true,
    reports: true,
    textLogs: true,
    photoLogs: true,
    voiceLogs: true,
    aiAnalysis: true,
    objectiveTemplates: UNLIMITED,
    shareTemplates: UNLIMITED,
    shareCustomization: true,
    dataExport: true,
    remindersPerHabit: UNLIMITED,
    themes: true,
    aiCallsPerMonth: 150
  }
};
export {
  AI_OUTPUT_SCHEMAS,
  AI_SYSTEM_PROMPT,
  PLAN_LIMITS,
  aiEndpointRequestSchema,
  userPromptFor
};
