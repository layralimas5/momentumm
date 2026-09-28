import { activityType, formatUnit, type ActivityType, type ActivityTypeSlug } from './activity-type'
import type { HabitIcon } from './habit'
import { detectBlueprint, type BlueprintWhen, type PlanBlueprint } from './plan-blueprint'
import { addDays, daysBetween, type DayKey } from './day'
import type { NewGoalInput } from './goal'
import { MAX_OBJECTIVE_DAYS, type NewObjectiveInput } from './objective'
import { TOTAL_WEIGHT } from './plan-stage'
import type { NewHabitInput } from './habit'
import type { NewTaskInput } from './task'

/**
 * O gerador de plano.
 *
 * É o passo em que o Momentumm para de perguntar e começa a responder: recebe
 * o objetivo, o prazo e quantos dias por semana cabem na vida da pessoa, e
 * devolve o plano inteiro pronto pra virar hábito e ação.
 *
 * Três regras mandam aqui:
 *
 * 1. **Nada de aleatório.** A conta é aritmética simples sobre o alvo, o prazo
 *    e a disponibilidade. O mesmo pedido gera sempre o mesmo plano, e a pessoa
 *    consegue conferir a matemática na tela.
 * 2. **O plano diz quando não cabe.** Se a sessão necessária passa do que um
 *    ser humano sustenta, o plano avisa e sugere esticar o prazo em vez de
 *    entregar um cronograma que só funciona no papel.
 * 3. **O tempo declarado manda.** A pessoa diz quantos minutos por dia consegue
 *    dar, e nenhum plano pode pedir mais que isso. Quando pede, o plano diz em
 *    voz alta que não cabe, e mostra o prazo em que caberia.
 * 4. **Sai daqui com uma ação pra hoje.** Plano que começa amanhã não começa.
 * 5. **O assunto manda no conteúdo.** Quando o objetivo casa com um roteiro de
 *    `plan-blueprint`, as etapas, os hábitos e as ações saem de lá, com nome e
 *    sentido próprios. Sem casamento, valem os três degraus genéricos, que não
 *    são ruins, são só genéricos. A aritmética é a mesma nos dois casos: o
 *    roteiro diz O QUE, este arquivo diz QUANTO e QUANDO.
 */

export type PlannedObjective = Omit<NewObjectiveInput, 'userId'>
export type PlannedGoal = Omit<NewGoalInput, 'userId'>

/**
 * Ação do plano, já sabendo em que etapa ela nasce.
 *
 * O índice aponta pra posição em `PlanDraft.stages` e não pra um id porque a
 * etapa ainda não existe quando o plano é montado: quem grava resolve os dois
 * na mesma passada. É o mesmo contrato que a sugestão da IA usa (`stepIndex`),
 * e ter dois formatos diferentes pra dizer a mesma coisa seria o começo de dois
 * caminhos divergindo.
 */
export interface PlannedTask extends Omit<NewTaskInput, 'userId'> {
  readonly stageIndex: number | null
}

/**
 * Etapa do plano gerado.
 *
 * Sem ela o objetivo nasce como uma lista de três ações: a barra passa a medir
 * volume registrado, o app não consegue apontar gargalo nem previsão, e todas
 * as regras de insight que leem etapa ficam de fora, inclusive a que cobra
 * justamente o objetivo sem plano.
 */
/**
 * Hábito do plano, já sabendo a que etapa ele pertence.
 *
 * O construtor NÃO criava hábito, e o comentário dizia o motivo: um
 * "Trabalhar pra <objetivo>" gerado aqui só duplicava o objetivo com outro
 * nome na tela de Hábitos. A razão continua de pé pro plano genérico, e é por
 * isso que ele segue sem hábito nenhum.
 *
 * O que mudou é que o roteiro por assunto traz hábitos que NÃO são o objetivo
 * com outro nome: "Registrar o que comi" e "Anotar as cargas do treino" são
 * comportamentos distintos, que o assunto exige e que ninguém deduz sozinho.
 */
export interface PlannedHabit extends Omit<NewHabitInput, 'userId'> {
  readonly stageIndex: number | null
}

export interface PlannedStage {
  readonly title: string
  readonly description: string | null
  /** Quanto vale do objetivo. O conjunto soma 100, como o domínio exige. */
  readonly weight: number
  readonly dueOn: DayKey
}

export const FEASIBILITIES = ['confortavel', 'exigente', 'irreal'] as const
export type Feasibility = (typeof FEASIBILITIES)[number]

export interface PlanDraft {
  readonly objective: PlannedObjective
  readonly goal: PlannedGoal
  /** O caminho até o objetivo. As ações nascem dentro de uma dessas etapas. */
  readonly stages: readonly PlannedStage[]
  /** A repetição que sustenta o objetivo. Vazia no plano genérico. */
  readonly habits: readonly PlannedHabit[]
  /** A primeira sempre cai hoje e sempre nasce como prioridade principal. */
  readonly tasks: readonly PlannedTask[]
  readonly feasibility: Feasibility
  /** Quanto o plano pede por sessão, na unidade do eixo. */
  readonly perSession: number
  /** O mesmo pedido convertido em minutos, pra bater com o tempo declarado. */
  readonly minutesPerSession: number
  /** Minutos por dia que este objetivo recebeu do orçamento da pessoa. */
  readonly minutesPerDay: number
  readonly sessionsPerWeek: number
  readonly totalSessions: number
  /** A explicação da conta, em uma frase. */
  readonly rationale: string
  /**
   * O roteiro que montou este plano, quando houve um.
   *
   * A prévia usa pra dizer em voz alta que o plano é DE alguma coisa ("Plano
   * de emagrecimento") em vez de deixar a pessoa descobrir pelas etapas, e pra
   * mostrar o limite do que o app faz quando o assunto pede (`caution`).
   */
  readonly blueprint: PlanBlueprint | null
  /** Preenchido só quando o plano não cabe: o que fazer a respeito. */
  readonly warning: string | null
  /**
   * Prazo que tornaria o plano sustentável. Null quando já está, e também
   * quando a data necessária passaria do limite do objetivo: oferecer um prazo
   * que o domínio vai recusar é pior que não oferecer nada.
   */
  readonly suggestedDeadline: DayKey | null
  /** Alvo que caberia no prazo e no tempo atuais. É a outra saída possível. */
  readonly fittingTarget: number
}

export interface PlanInput {
  readonly axis: ActivityTypeSlug
  readonly title: string
  readonly target: number
  readonly today: DayKey
  readonly deadline: DayKey
  /** Dias por semana que a pessoa se compromete a aparecer. */
  readonly daysPerWeek: number
  /**
   * Os dias da semana escolhidos, quando a pessoa marcou quais são (0 =
   * domingo). Sem isso o plano distribui por conta própria, o que é um
   * palpite razoável, mas um palpite. Quem disse "terça e quinta" recebe terça
   * e quinta.
   */
  readonly weekdays?: readonly number[]
  /** Minutos por dia reservados PRA ESTE objetivo. É o teto de tudo. */
  readonly minutesPerDay: number
  /**
   * Nome da área, quando o eixo ainda não existe no registro.
   *
   * O onboarding monta a prévia inteira ANTES de gravar a área, é o que
   * evita uma linha órfã em `activity_types` pra cada pessoa que desiste no
   * meio. Sem este campo, o roteiro cairia no rótulo derivado do slug e o
   * hábito nasceria chamado "Dedicar tempo a financas", sem acento e com
   * cara de identificador.
   */
  readonly axisLabel?: string
  /**
   * O roteiro da ÁREA, quando ela não tem eixo de fábrica equivalente.
   *
   * Sem isso, "Saúde" e "Finanças" caem no roteiro genérico e a ação de hoje
   * vira "Dar o primeiro passo pra <o objetivo que a pessoa escreveu>", que é
   * o app devolvendo a frase dela em vez de dizer o que fazer hoje.
   */
  readonly template?: AxisTemplate
  readonly motive?: string | null
}

interface SessionLimits {
  readonly comfortable: number
  readonly ceiling: number
}

/** Sessão que ainda é confortável, e o teto do que uma pessoa sustenta por meses. */
const SESSION_LIMITS: Readonly<Record<string, SessionLimits>> = {
  leitura: { comfortable: 25, ceiling: 60 },
  estudo: { comfortable: 45, ceiling: 120 },
  treino: { comfortable: 45, ceiling: 90 },
  meditacao: { comfortable: 15, ceiling: 40 },
}

/**
 * Área criada pela pessoa não tem limite estudado, então recebe um genérico
 * conservador: 30 minutos confortáveis, 90 de teto. Errar pra menos é seguro,
 * o plano fica exigente e ela ajusta; errar pra mais entrega um cronograma que
 * ninguém cumpre.
 */
const DEFAULT_SESSION_LIMITS: SessionLimits = { comfortable: 30, ceiling: 90 }

function limitsOfAxis(axis: ActivityTypeSlug): SessionLimits {
  return SESSION_LIMITS[axis] ?? DEFAULT_SESSION_LIMITS
}

/**
 * A sessão que se sustenta por meses nesse eixo, na unidade dele.
 *
 * Exportada porque é a régua de "quanto esse tipo de objetivo pede de
 * verdade", e é contra ela que o onboarding compara a disponibilidade
 * declarada antes de gerar qualquer plano. Note que ela NÃO leva o tempo da
 * pessoa em conta de propósito: é o pedido do eixo, não o que já foi cortado
 * pra caber.
 */
export function comfortableSessionOf(axis: ActivityTypeSlug): number {
  return limitsOfAxis(axis).comfortable
}

export interface AxisTemplate {
  readonly firstStep: string
  readonly firstStepMinimal: string
  readonly preparation: string
  readonly preparationMinimal: string
  readonly checkpoint: string
}

const TEMPLATES: Readonly<Record<string, AxisTemplate>> = {
  leitura: {
    firstStep: 'Abrir o livro e ler a primeira sessão',
    firstStepMinimal: 'Ler 3 páginas',
    preparation: 'Deixar o livro onde você vai sentar',
    preparationMinimal: 'Escolher o próximo livro',
    checkpoint: 'Conferir o ritmo de leitura e ajustar o plano',
  },
  estudo: {
    firstStep: 'Fazer a primeira sessão de estudo',
    firstStepMinimal: 'Reler as anotações por 5 minutos',
    preparation: 'Montar a lista do que precisa ser estudado',
    preparationMinimal: 'Anotar os três primeiros tópicos',
    checkpoint: 'Revisar o que já foi estudado e recalibrar o plano',
  },
  treino: {
    firstStep: 'Fazer o primeiro treino',
    firstStepMinimal: 'Fazer 10 minutos de movimento',
    preparation: 'Separar a roupa e definir o horário do treino',
    preparationMinimal: 'Separar a roupa de treino',
    checkpoint: 'Avaliar a evolução do treino e ajustar a carga',
  },
  meditacao: {
    firstStep: 'Fazer a primeira sessão guiada',
    firstStepMinimal: 'Respirar por 3 minutos',
    preparation: 'Escolher o lugar e o horário fixo da prática',
    preparationMinimal: 'Escolher o horário da prática',
    checkpoint: 'Rever como a prática está encaixando na rotina',
  },
}

/**
 * Roteiro de qualquer área criada pela pessoa.
 *
 * As frases nascem do OBJETIVO que ela escreveu, não do nome da área: "Dar o
 * primeiro passo pra ter 30 leads" é um plano; "Fazer a primeira sessão de
 * carreira" é um formulário preenchido com o que sobrou. A área só entra
 * quando não há objetivo em palavras.
 */
function templateFor(
  axis: ActivityTypeSlug,
  axisLabel?: string,
  goal?: string,
  given?: AxisTemplate,
): AxisTemplate {
  const known = TEMPLATES[axis]
  if (known) return known
  if (given) return given

  const focus = goalPhrase(goal)
  if (focus) {
    return {
      firstStep: `Dar o primeiro passo pra ${focus}`,
      firstStepMinimal: 'Fazer 5 minutos, só pra começar',
      preparation: `Listar o que falta pra ${focus}`,
      preparationMinimal: 'Anotar o primeiro passo',
      checkpoint: `Rever o caminho até ${focus}`,
    }
  }

  const label = (axisLabel ?? activityType(axis).label).toLowerCase()

  return {
    firstStep: `Fazer a primeira sessão de ${label}`,
    firstStepMinimal: 'Fazer 5 minutos, só pra começar',
    preparation: `Separar o que você precisa pra ${label}`,
    preparationMinimal: 'Anotar o primeiro passo',
    checkpoint: `Rever como ${label} está encaixando na rotina`,
  }
}

/**
 * O objetivo como complemento de frase: "Ter 30 leads do Momentumm" vira
 * "ter 30 leads do Momentumm". Só a primeira letra cai, porque o resto pode
 * ser nome próprio. Objetivo longo demais deixaria a ação com três linhas.
 */
function goalPhrase(goal: string | undefined): string | null {
  const trimmed = goal?.trim().replace(/[.!]+$/, '')
  if (!trimmed || trimmed.length < 3 || trimmed.length > 60) return null
  // Um título de fallback ("Carreira: primeiro passo") não é objetivo escrito.
  if (/: primeiro passo$/.test(trimmed)) return null
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
}


export const MIN_DAYS_PER_WEEK = 1
export const MAX_DAYS_PER_WEEK = 7

export const MIN_MINUTES_PER_DAY = 5
export const MAX_MINUTES_PER_DAY = 8 * 60

/** Os tempos que a pergunta oferece. Quinze minutos é o piso que vira hábito. */
export const MINUTES_PER_DAY_PRESETS: readonly number[] = [15, 30, 45, 60, 90]

/**
 * Ritmo médio de leitura. Existe pra converter minutos em páginas sem pedir
 * mais um número no onboarding: erra pouco e a pessoa corrige o alvo se quiser.
 */
const MINUTES_PER_PAGE = 1.5

/** O tempo declarado convertido pra unidade do eixo. É o teto de cada sessão. */
function capacityPerSession(axis: ActivityTypeSlug, minutesPerDay: number): number {
  const minutes = clamp(Math.round(minutesPerDay), MIN_MINUTES_PER_DAY, MAX_MINUTES_PER_DAY)
  return activityType(axis).unit === 'minutos'
    ? minutes
    : Math.max(1, Math.floor(minutes / MINUTES_PER_PAGE))
}

export function buildPlan(input: PlanInput): PlanDraft {
  const type = activityType(input.axis)
  const template = templateFor(input.axis, input.axisLabel, input.title, input.template)
  const limits = limitsOfAxis(input.axis)
  const blueprint = detectBlueprint(input.title, input.axis, input.motive)

  const daysPerWeek = clamp(Math.round(input.daysPerWeek), MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK)
  const totalDays = Math.max(1, daysBetween(input.today, input.deadline) + 1)
  const weeks = totalDays / 7

  // Arredonda pra baixo: prometer sessão que não existe no calendário é a
  // maneira mais rápida de gerar um plano que já nasce atrasado.
  const totalSessions = Math.max(1, Math.floor(weeks * daysPerWeek))
  const perSession = Math.max(1, Math.ceil(input.target / totalSessions))
  const weeklyTarget = Math.max(1, Math.ceil(input.target / Math.max(1, weeks)))

  /*
    O tempo declarado entra como teto por cima dos limites do eixo. Quem diz que
    tem 15 minutos por dia não recebe um plano de 45, mesmo que 45 seja
    confortável pro eixo: o plano precisa caber na vida que a pessoa descreveu,
    não na vida que o app gostaria que ela tivesse.
  */
  const capacity = capacityPerSession(input.axis, input.minutesPerDay)
  const comfortable = Math.min(limits.comfortable, capacity)
  const ceiling = Math.min(limits.ceiling, capacity)

  const feasibility: Feasibility =
    perSession > ceiling ? 'irreal' : perSession > comfortable ? 'exigente' : 'confortavel'

  // A outra saída: manter o prazo e baixar o alvo pro que o tempo comporta.
  const fittingTarget = Math.max(1, comfortable * totalSessions)

  const suggestedDeadline =
    feasibility === 'irreal' ? sustainableDeadline(input, daysPerWeek, comfortable) : null

  /*
    O plano não cria hábito. Hábito é rotina que a pessoa escolhe por conta
    própria (treinar, ler, meditar), e um "Trabalhar pra <objetivo>" gerado
    aqui só duplicava o objetivo com outro nome na tela de Hábitos. O ritmo
    do objetivo já mora na meta semanal e nas ações.
  */

  const checkpointDay = addDays(input.today, Math.max(3, Math.floor(totalDays / 2)))

  const stages = blueprint
    ? blueprintStages(blueprint, input, totalDays)
    : stagesFor(input, totalDays, type, { totalSessions, perSession, daysPerWeek })

  /*
    Cada ação já nasce dentro de uma etapa. As duas primeiras constroem a
    rotina, então pertencem à etapa de entrada; a conferência de ritmo cai na
    etapa do meio, que é exatamente o que ela mede. A última etapa nasce vazia
    de propósito: o que fecha o objetivo ainda não se sabe hoje, e inventar uma
    ação pra ela seria encher o plano de trabalho que ninguém pediu.
  */
  const generic: readonly PlannedTask[] = [
    {
      title: template.firstStep,
      axis: input.axis,
      estimatedMin: estimatedMinutes(input.axis, perSession),
      effort: feasibility === 'confortavel' ? 'medio' : 'pesado',
      minimalVersion: template.firstStepMinimal,
      day: input.today,
      isMainPriority: true,
      stageIndex: 0,
    },
    {
      title: template.preparation,
      axis: input.axis,
      estimatedMin: 10,
      effort: 'leve',
      minimalVersion: template.preparationMinimal,
      day: input.today,
      isMainPriority: false,
      stageIndex: 0,
    },
    {
      title: template.checkpoint,
      axis: input.axis,
      estimatedMin: 15,
      effort: 'leve',
      minimalVersion: 'Olhar o gráfico da semana e anotar uma conclusão',
      day: checkpointDay,
      isMainPriority: false,
      stageIndex: 1,
    },
  ]

  const tasks = blueprint
    ? blueprintTasks(blueprint, input, totalDays)
    : generic
  const habits = blueprint ? blueprintHabits(blueprint, input) : []

  return {
    objective: {
      title: input.title.trim(),
      axis: input.axis,
      target: Math.round(input.target),
      startedOn: input.today,
      deadline: input.deadline,
      motive: input.motive ?? null,
    },
    goal: { type: input.axis, target: weeklyTarget, period: 'semana' },
    stages,
    habits,
    tasks,
    blueprint,
    feasibility,
    perSession,
    minutesPerSession: estimatedMinutes(input.axis, perSession),
    minutesPerDay: Math.round(input.minutesPerDay),
    sessionsPerWeek: daysPerWeek,
    totalSessions,
    /*
      A conversão em minutos só aparece quando ela ACRESCENTA alguma coisa.
      Num eixo medido em tempo a frase virava "30 minutos por sessão, cerca
      de 30 minutos", que é o app repetindo o mesmo número e parecendo que
      não entendeu a própria conta.
    */
    rationale: blueprint
      ? blueprint.rationale
      : `${formatUnit(type, Math.round(input.target))} em ${totalDays} dias, em ${daysPerWeek} ${daysPerWeek === 1 ? 'dia' : 'dias'} por semana, dá ${formatUnit(type, perSession)} por sessão${
          type.unit === 'minutos' ? '' : ` (cerca de ${estimatedMinutes(input.axis, perSession)} minutos)`
        }.`,
    warning: warningFor(feasibility, input, perSession, capacity, suggestedDeadline, fittingTarget),
    suggestedDeadline,
    fittingTarget,
  }
}

/**
 * As etapas do roteiro, com data proporcional ao peso.
 *
 * O peso vem do roteiro (o assunto sabe onde está o trabalho) e a data sai
 * dele, exatamente como no plano genérico: uma etapa que vale 40% do objetivo
 * ocupa 40% do calendário. É a única distribuição que a pessoa confere de
 * cabeça, e ela mexe depois.
 */
function blueprintStages(
  blueprint: PlanBlueprint,
  input: PlanInput,
  totalDays: number,
): PlannedStage[] {
  let consumed = 0
  return blueprint.stages.map((stage, index) => {
    consumed += stage.weight
    const isLast = index === blueprint.stages.length - 1
    return {
      title: stage.title,
      description: stage.description,
      weight: stage.weight,
      dueOn: isLast
        ? input.deadline
        : addDays(input.today, Math.max(1, Math.round((consumed / TOTAL_WEIGHT) * totalDays) - 1)),
    }
  })
}

/**
 * Os hábitos do roteiro, dimensionados pelo tempo que a pessoa declarou.
 *
 * `share` é fração, não minutos: quem tem 20 minutos por dia e quem tem 90
 * recebem o mesmo roteiro, cada um no tamanho dele. O piso de 5 minutos existe
 * porque hábito de 2 minutos não é hábito, é lembrete, e o app tem lembrete.
 *
 * Todos nascem no eixo do OBJETIVO. O hábito podia ter eixo próprio, mas um
 * "Registrar o que comi" criando uma área nova no primeiro plano da pessoa
 * encheria a tela de Jornada de eixos que ela não pediu.
 */
function blueprintHabits(blueprint: PlanBlueprint, input: PlanInput): PlannedHabit[] {
  const budget = clamp(Math.round(input.minutesPerDay), MIN_MINUTES_PER_DAY, MAX_MINUTES_PER_DAY)

  /*
    Os GESTOS levam minutos fixos e pequenos, e saem do orçamento antes de
    tudo. "Beber água ao acordar" não dura mais porque a pessoa tem mais tempo
    livre: ele é feito ou não é. Escalá-lo pelo orçamento produzia números sem
    sentido e roubava do hábito que de fato ocupa o dia.

    O que sobra é dividido entre os hábitos de DURAÇÃO, cujas frações somam 1.
    O piso de 10 minutos existe porque sessão de 3 minutos não é sessão, e o
    plano prefere avisar que não cabe a entregar um hábito decorativo.
  */
  const spent = blueprint.habits.reduce((total, habit) => total + (habit.fixedMinutes ?? 0), 0)
  const left = Math.max(10, budget - spent)

  return blueprint.habits.map((habit) => {
    const fixed = habit.fixedMinutes
    const target = fixed ?? Math.max(5, Math.round(left * (habit.share ?? 1)))
    const minimal = fixed
      ? (habit.minimalMinutes ?? fixed)
      : Math.max(3, Math.round(target * (habit.minimalShare ?? 0.3)))

    return {
      name: habit.name,
      icon: habit.icon as HabitIcon,
      axis: input.axis,
      dayPart: habit.dayPart,
      frequency: habit.frequency,
      timesPerWeek: habit.timesPerWeek,
      target,
      minimalTarget: Math.min(minimal, target),
      description: habit.rationale,
      stageIndex: null,
    }
  })
}

/**
 * As ações do roteiro, espalhadas pelo calendário.
 *
 * `when` é posição no caminho, não data: o mesmo roteiro serve pra um prazo de
 * três semanas e pra um de seis meses. "hoje" é sempre hoje, porque plano que
 * começa amanhã não começa, e a primeira ação de hoje é a prioridade principal.
 *
 * `estimatedMin` do roteiro é um pedido, não uma ordem: ele é cortado pelo
 * tempo que a pessoa declarou ter. Uma ação de 60 minutos pra quem reservou 20
 * é uma ação que não vai acontecer, e o app já sabe disso antes de gravar.
 */
function blueprintTasks(
  blueprint: PlanBlueprint,
  input: PlanInput,
  totalDays: number,
): PlannedTask[] {
  const fractions: Readonly<Record<BlueprintWhen, number>> = {
    hoje: 0,
    'primeira-semana': 0.1,
    meio: 0.5,
    'reta-final': 0.85,
  }

  /*
    Duas ações do mesmo momento não caem no mesmo dia.

    Sem isto, "refazer os erros" e "fazer o simulado final" nasciam os dois na
    mesma data, somando quatro horas num dia só. Cada ação seguinte do mesmo
    momento anda alguns dias pra frente, proporcional ao prazo: num plano de
    três meses o passo é maior que num de três semanas.
  */
  const step = Math.max(1, Math.round(totalDays / 20))
  const used = new Map<BlueprintWhen, number>()

  let mainTaken = false

  return blueprint.tasks.map((task) => {
    const seen = used.get(task.when) ?? 0
    used.set(task.when, seen + 1)

    const base = Math.round(totalDays * fractions[task.when])
    const day =
      task.when === 'hoje'
        ? input.today
        : addDays(input.today, clamp(base + seen * step, 1, totalDays - 1))

    const isMain = !mainTaken && day === input.today
    if (isMain) mainTaken = true

    /*
      A estimativa é do ROTEIRO, e não é cortada pelo tempo diário.

      Um simulado cronometrado leva duas horas, tenha a pessoa 15 minutos por
      dia ou três. Encolher o número pra caber no orçamento deixaria a conta do
      dia errada em todo lugar que a lê (o `Hoje`, o aviso de sobrecarga, a
      reorganização), e a pessoa descobriria a mentira na primeira vez que
      tentasse fazer. O que existe pro dia apertado é a versão mínima, e ela
      vem escrita em cada ação.
    */
    return {
      title: task.title,
      axis: input.axis,
      estimatedMin: clamp(task.estimatedMin, 5, 8 * 60),
      effort: task.effort,
      minimalVersion: task.minimalVersion,
      day,
      isMainPriority: isMain,
      stageIndex: Math.min(task.stageIndex, blueprint.stages.length - 1),
    }
  })
}

/**
 * O caminho até o objetivo, em três degraus.
 *
 * Três e não cinco porque o plano é gerado sem saber nada do assunto: o que dá
 * pra afirmar de qualquer objetivo com alvo e prazo é que existe um começo, uma
 * metade e um fim. Quem quiser um caminho mais fino quebra as etapas na mão,
 * e aí o app tem o que refinar em vez de uma lista chapada.
 *
 * O peso não é igual: entrar no ritmo é o degrau mais curto e o que menos
 * constrói do objetivo. Dar 33% a ele faria a barra pular pra um terço com a
 * pessoa tendo lido três páginas.
 */
function stagesFor(
  input: PlanInput,
  totalDays: number,
  type: ActivityType,
  rhythm: { totalSessions: number; perSession: number; daysPerWeek: number },
): PlannedStage[] {
  const target = Math.round(input.target)
  const half = Math.max(1, Math.round(target / 2))

  /*
    Num eixo medido em tempo, o total acumulado não diz nada: "acumular 765
    minutos" é um número que ninguém consegue imaginar. O que a pessoa
    reconhece é quantas vezes ela vai aparecer, então o degrau é contado em
    sessões. Nos eixos com unidade própria (páginas, por exemplo) o acumulado
    continua valendo: 120 páginas é uma imagem, 120 minutos não.

    As sessões saem do mesmo peso que distribui as datas: uma etapa que ocupa
    40% do calendário ocupa 40% das sessões.
  */
  const byTime = type.unit === 'minutos'
  const sessionsUntil = (weight: number) =>
    Math.max(1, Math.round((weight / TOTAL_WEIGHT) * rhythm.totalSessions))
  const firstSessions = sessionsUntil(20)
  const halfSessions = sessionsUntil(60)
  const sessionWord = (count: number) => `${count} ${count === 1 ? 'sessão' : 'sessões'}`

  const drafts: readonly { title: string; description: string; weight: number }[] = [
    {
      title: 'Entrar no ritmo',
      description: byTime
        ? `Fazer as primeiras ${sessionWord(firstSessions)} de ${rhythm.perSession} min, até a rotina existir.`
        : 'Preparar o que precisa e fazer as primeiras sessões, até a rotina existir.',
      weight: 20,
    },
    {
      title: 'Chegar na metade',
      description: byTime
        ? `Chegar a ${sessionWord(halfSessions)} e conferir se o ritmo está de pé.`
        : `Acumular ${formatUnit(type, half)} e conferir se o ritmo está de pé.`,
      weight: 40,
    },
    {
      title: 'Fechar o objetivo',
      description: byTime
        ? `Ir de ${halfSessions} até as ${sessionWord(rhythm.totalSessions)} do plano.`
        : `Ir de ${formatUnit(type, half)} até ${formatUnit(type, target)}.`,
      weight: 40,
    },
  ]

  // Data proporcional ao peso: uma etapa de 40% ocupa 40% do calendário. É a
  // única distribuição que a pessoa confere de cabeça, e ela mexe depois.
  let consumed = 0
  return drafts.map((draft, index) => {
    consumed += draft.weight
    const isLast = index === drafts.length - 1
    return {
      title: draft.title,
      description: draft.description,
      weight: draft.weight,
      dueOn: isLast
        ? input.deadline
        : addDays(input.today, Math.max(1, Math.round((consumed / TOTAL_WEIGHT) * totalDays) - 1)),
    }
  })
}

function warningFor(
  feasibility: Feasibility,
  input: PlanInput,
  perSession: number,
  capacity: number,
  suggestedDeadline: DayKey | null,
  fittingTarget: number,
): string | null {
  const type = activityType(input.axis)
  const minutes = estimatedMinutes(input.axis, perSession)

  if (feasibility === 'confortavel') return null

  if (feasibility === 'exigente') {
    return `${formatUnit(type, perSession)} por sessão, cerca de ${minutes} minutos: é puxado, mas cabe. Se apertar, a versão mínima do hábito segura a sequência.`
  }

  /*
    As duas saídas honestas: esticar o prazo ou baixar o alvo. Quando nem o
    prazo máximo resolve, sobra uma só, e é ela que o aviso oferece, em vez de
    mandar a pessoa esperar dois anos por um objetivo.
  */
  const extraDays = suggestedDeadline ? daysBetween(input.deadline, suggestedDeadline) : 0
  const wayOut = suggestedDeadline
    ? `Aumentar o prazo em ${extraDays} ${extraDays === 1 ? 'dia' : 'dias'} resolve, e baixar o alvo pra ${formatUnit(type, fittingTarget)} também.`
    : `Nem o prazo máximo resolve esse alvo com esse tempo. Nesse prazo cabem ${formatUnit(type, fittingTarget)}, ou você reserva mais minutos por dia.`

  // Quando o teto é o tempo declarado, o aviso diz isso com todas as letras: a
  // pessoa acabou de responder quanto tempo tem, e o plano está pedindo mais.
  return perSession > capacity
    ? `Esse plano pede ${minutes} minutos por sessão e você reservou ${Math.round(input.minutesPerDay)} por dia. Não cabe. ${wayOut}`
    : `Esse prazo exige ${formatUnit(type, perSession)} por sessão, acima do que se sustenta por semanas seguidas. ${wayOut}`
}

/**
 * O prazo em que a sessão volta pro tamanho confortável.
 *
 * Devolve null quando a data necessária passaria do limite do objetivo: um
 * botão que oferece um prazo que o domínio recusa é pior que botão nenhum.
 */
function sustainableDeadline(
  input: PlanInput,
  daysPerWeek: number,
  comfortable: number,
): DayKey | null {
  const sessionsNeeded = Math.ceil(input.target / comfortable)
  const daysNeeded = Math.ceil((sessionsNeeded / daysPerWeek) * 7)
  if (daysNeeded > MAX_OBJECTIVE_DAYS) return null
  return addDays(input.today, daysNeeded - 1)
}

/** Tempo estimado da ação. Eixo em minutos já é o próprio tempo. */
function estimatedMinutes(axis: ActivityTypeSlug, perSession: number): number {
  const raw =
    activityType(axis).unit === 'minutos' ? perSession : Math.round(perSession * MINUTES_PER_PAGE)
  return clamp(raw, 5, 8 * 60)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Alvo sugerido quando a pessoa ainda não tem número na cabeça.
 *
 * Sai do tempo que ela acabou de declarar, não de uma tabela: sugerir um alvo
 * maior do que o próprio app sabe que cabe seria pedir pra ela começar já
 * atrasada.
 */
export function suggestedTarget(
  axis: ActivityTypeSlug,
  days: number,
  minutesPerDay: number,
  daysPerWeek: number,
): number {
  const perSession = Math.min(
    limitsOfAxis(axis).comfortable,
    capacityPerSession(axis, minutesPerDay),
  )
  const frequency = clamp(Math.round(daysPerWeek), MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK)
  const sessions = Math.max(1, Math.floor((days / 7) * frequency))
  return Math.max(1, perSession * sessions)
}

// ---------------------------------------------------------------------------
// mais de um objetivo
// ---------------------------------------------------------------------------

/** Mais que isso não é foco, é lista de desejos: um por eixo, quatro eixos. */
export const MAX_OBJECTIVES_AT_ONCE = 4

export interface ObjectiveSeed {
  readonly axis: ActivityTypeSlug
  readonly title: string
  readonly target: number
  readonly deadline: DayKey
  readonly motive?: string | null
}

export interface CombinedPlanInput {
  readonly seeds: readonly ObjectiveSeed[]
  readonly today: DayKey
  readonly daysPerWeek: number
  /** O total que a pessoa tem por dia, pra dividir entre todos os objetivos. */
  readonly minutesPerDay: number
}

export interface CombinedPlan {
  readonly plans: readonly PlanDraft[]
  /** O que a pessoa disse que tem. */
  readonly minutesPerDay: number
  /** O que os planos somados pedem num dia de sessão. */
  readonly requiredMinutesPerDay: number
  readonly fits: boolean
  /** O veredito do conjunto, em uma frase. */
  readonly verdict: string
}

/**
 * Vários objetivos dividindo o mesmo dia.
 *
 * O tempo é dividido em partes iguais porque é a única divisão que a pessoa
 * consegue conferir de cabeça, e porque no primeiro dia ninguém sabe ainda
 * qual objetivo merece mais. O que o app não faz é fingir que 30 minutos viram
 * 90 quando ela escolhe três áreas: o veredito soma o que os planos pedem e
 * compara com o que ela disse que tem.
 */
export function buildCombinedPlan(input: CombinedPlanInput): CombinedPlan {
  const seeds = input.seeds.slice(0, MAX_OBJECTIVES_AT_ONCE)
  const share = seeds.length === 0 ? input.minutesPerDay : input.minutesPerDay / seeds.length

  const plans = seeds.map((seed) =>
    buildPlan({
      axis: seed.axis,
      title: seed.title,
      target: seed.target,
      today: input.today,
      deadline: seed.deadline,
      daysPerWeek: input.daysPerWeek,
      minutesPerDay: share,
      motive: seed.motive ?? null,
    }),
  )

  const requiredMinutesPerDay = plans.reduce((total, plan) => total + plan.minutesPerSession, 0)
  const minutesPerDay = Math.round(input.minutesPerDay)

  /*
    Tolerância do arredondamento, não folga de verdade.

    Cada plano arredonda a sessão pra cima, então N planos podem somar até N
    minutos a mais que o orçamento por pura conta quebrada. Sem essa margem, a
    tela diria "cada plano cabe" e "o conjunto não cabe" ao mesmo tempo, e
    quem lê isso perde a confiança nos dois números.
  */
  const fits = requiredMinutesPerDay <= minutesPerDay + plans.length

  return {
    plans,
    minutesPerDay,
    requiredMinutesPerDay,
    fits,
    verdict: verdictFor(plans, minutesPerDay, requiredMinutesPerDay, fits),
  }
}

function verdictFor(
  plans: readonly PlanDraft[],
  minutesPerDay: number,
  required: number,
  fits: boolean,
): string {
  if (plans.length === 0) {
    return 'Escolhe pelo menos uma área pra o plano existir.'
  }

  const share = Math.floor(minutesPerDay / plans.length)

  if (plans.length === 1) {
    return fits
      ? `Um objetivo com ${minutesPerDay} minutos por dia: cabe com folga.`
      : `Um objetivo pedindo ${required} minutos por dia contra os ${minutesPerDay} que você reservou.`
  }

  const split = `${plans.length} objetivos dividem os ${minutesPerDay} minutos do teu dia, ${share} pra cada`

  if (fits) {
    return `${split}. O conjunto cabe.`
  }

  return `${split}, mas o conjunto pede ${required}. Tira um objetivo dessa lista ou estica os prazos: o dia não estica.`
}
