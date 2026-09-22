import {
  buildActivation,
  type ActivationAnswers,
  type ActivationPlan,
  type ActivationRemedyKey,
  type Horizon,
  type LifeAreaKey,
} from './activation'
import type { ActivityTypeSlug } from './activity-type'
import { dayKeyToDate, daysBetween, formatDayLong, parseDayKey, type DayKey } from './day'
import { type DayPart, type HabitIcon } from './habit'
import { MIN_OBJECTIVE_DAYS } from './objective'

/**
 * O quiz de entrada: sete perguntas respondidas ANTES de existir conta.
 *
 * Ele não tem gerador próprio. As respostas viram as mesmas
 * `ActivationAnswers` que o onboarding usa, e o plano sai do mesmo
 * `buildActivation`: objetivo, três marcos, ritmo e primeiro passo. O que o
 * quiz acrescenta é a leitura do que trava a pessoa (o diagnóstico) e o
 * hábito de sustentação, e é só isso que este arquivo calcula.
 *
 * A regra que muda em relação ao onboarding: aqui não pode haver beco sem
 * saída. Quem responde o quiz ainda não conhece o produto, então um plano
 * que não cabe na rotina é ajustado sozinho (pelas mesmas saídas que o
 * onboarding oferece como botão) e a prévia diz o que foi ajustado.
 */

// ---------------------------------------------------------------------------
// as perguntas
// ---------------------------------------------------------------------------

export const QUIZ_AREAS = [
  'saude',
  'carreira',
  'estudos',
  'financas',
  'pessoal',
  'relacionamentos',
  'projeto',
  'outra',
] as const
export type QuizAreaKey = (typeof QUIZ_AREAS)[number]

export const QUIZ_AREA_LABELS: Readonly<Record<QuizAreaKey, string>> = {
  saude: 'Saúde',
  carreira: 'Carreira',
  estudos: 'Estudos',
  financas: 'Finanças',
  pessoal: 'Desenvolvimento pessoal',
  relacionamentos: 'Relacionamentos',
  projeto: 'Projeto pessoal',
  outra: 'Outra',
}

export const QUIZ_OBSTACLES = [
  'procrastino',
  'abandono',
  'pouco_tempo',
  'sem_comeco',
  'rotina_muda',
  'tudo_ao_mesmo_tempo',
  'motivacao',
] as const
export type QuizObstacleKey = (typeof QUIZ_OBSTACLES)[number]

export const QUIZ_OBSTACLE_LABELS: Readonly<Record<QuizObstacleKey, string>> = {
  procrastino: 'Procrastino',
  abandono: 'Começo e abandono',
  pouco_tempo: 'Tenho pouco tempo',
  sem_comeco: 'Não sei por onde começar',
  rotina_muda: 'Minha rotina muda muito',
  tudo_ao_mesmo_tempo: 'Quero fazer tudo ao mesmo tempo',
  motivacao: 'Perco a motivação rapidamente',
}

export const QUIZ_TIMES = ['10', '20', '30', '60', '90', 'depende'] as const
export type QuizTimeKey = (typeof QUIZ_TIMES)[number]

export const QUIZ_TIME_LABELS: Readonly<Record<QuizTimeKey, string>> = {
  '10': '10 minutos',
  '20': '20 minutos',
  '30': '30 minutos',
  '60': '1 hora',
  '90': 'Mais de 1 hora',
  depende: 'Depende do dia',
}

/**
 * "Depende do dia" vira 20 minutos: é o tempo que cabe em quase qualquer dia,
 * e cada ação já nasce com versão mínima pros dias em que nem isso cabe.
 */
export const VARIABLE_DAY_MINUTES = 20

export const QUIZ_HORIZONS = ['30', '90', '180', 'fim_do_ano', 'nao_sei'] as const
export type QuizHorizonKey = (typeof QUIZ_HORIZONS)[number]

export const QUIZ_HORIZON_LABELS: Readonly<Record<QuizHorizonKey, string>> = {
  '30': '30 dias',
  '90': '3 meses',
  '180': '6 meses',
  fim_do_ano: 'Até o final do ano',
  nao_sei: 'Ainda não sei',
}

export const QUIZ_STYLES = [
  'passos_pequenos',
  'rotina_definida',
  'metas_semanais',
  'liberdade',
  'momentumm_decide',
] as const
export type QuizStyleKey = (typeof QUIZ_STYLES)[number]

export const QUIZ_STYLE_LABELS: Readonly<Record<QuizStyleKey, string>> = {
  passos_pequenos: 'Com passos pequenos',
  rotina_definida: 'Com uma rotina bem definida',
  metas_semanais: 'Com metas semanais',
  liberdade: 'Com liberdade para adaptar',
  momentumm_decide: 'Quero que o Momentumm decida por mim',
}

/** Exemplos que a primeira pergunta mostra. Tocar num deles preenche o campo. */
export const QUIZ_GOAL_EXAMPLES: readonly string[] = [
  'Criar uma rotina de exercícios',
  'Lançar meu projeto',
  'Estudar para uma prova',
  'Organizar minha vida',
  'Melhorar minha saúde',
]

export const QUIZ_QUESTION_COUNT = 7
export const MIN_GOAL_LENGTH = 3
export const MAX_GOAL_LENGTH = 120

export interface QuizAnswers {
  readonly goal: string
  /** As áreas marcadas, na ordem do toque. A primeira é a principal: é dela que sai o plano. */
  readonly areas: readonly QuizAreaKey[]
  /** Nome escrito pela pessoa quando marcou "Outra". */
  readonly customArea: string
  /** As dificuldades marcadas, na ordem do toque. A primeira dá o perfil. */
  readonly obstacles: readonly QuizObstacleKey[]
  readonly time: QuizTimeKey | null
  readonly horizon: QuizHorizonKey | null
  /** Dias da semana (0 = domingo). */
  readonly weekdays: readonly number[]
  readonly style: QuizStyleKey | null
}

export const EMPTY_QUIZ_ANSWERS: QuizAnswers = {
  goal: '',
  areas: [],
  customArea: '',
  obstacles: [],
  time: null,
  horizon: null,
  weekdays: [],
  style: null,
}

/** As respostas com todas as perguntas fechadas: só assim existe diagnóstico. */
export interface CompleteQuizAnswers extends QuizAnswers {
  readonly time: QuizTimeKey
  readonly horizon: QuizHorizonKey
  readonly style: QuizStyleKey
}

/**
 * O que falta pra sair da pergunta `step` (base zero). Null quando dá pra
 * avançar. É a única validação do quiz, e a tela só a repete.
 */
export function quizBlocker(step: number, answers: QuizAnswers): string | null {
  switch (step) {
    case 0:
      return answers.goal.trim().length < MIN_GOAL_LENGTH
        ? 'Escreve o que você quer conquistar.'
        : null
    case 1:
      return answers.areas.length === 0 ? 'Escolhe pelo menos uma área.' : null
    case 2:
      return answers.obstacles.length === 0 ? 'Escolhe pelo menos uma.' : null
    case 3:
      return answers.time === null ? 'Escolhe o tempo que cabe de verdade.' : null
    case 4:
      return answers.horizon === null ? 'Escolhe um prazo, mesmo que aproximado.' : null
    case 5:
      return answers.weekdays.length === 0 ? 'Marca pelo menos um dia.' : null
    case 6:
      return answers.style === null ? 'Escolhe como você prefere começar.' : null
    default:
      return null
  }
}

/** A área principal é a primeira marcada. */
export function primaryArea(answers: QuizAnswers): QuizAreaKey {
  return answers.areas[0] ?? 'pessoal'
}

/** A dificuldade principal é a primeira marcada. */
export function primaryObstacle(answers: QuizAnswers): QuizObstacleKey {
  return answers.obstacles[0] ?? 'procrastino'
}

export function isQuizComplete(answers: QuizAnswers): answers is CompleteQuizAnswers {
  for (let step = 0; step < QUIZ_QUESTION_COUNT; step += 1) {
    if (quizBlocker(step, answers) !== null) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// o tema que veio do conteúdo
// ---------------------------------------------------------------------------

export const QUIZ_THEMES = ['procrastinacao', 'constancia', 'tempo', 'comeco', 'foco'] as const
export type QuizThemeKey = (typeof QUIZ_THEMES)[number]

export interface QuizIntro {
  readonly title: string
  readonly description: string
}

export const DEFAULT_QUIZ_INTRO: QuizIntro = {
  title: 'Transforme sua meta em um plano possível.',
  description:
    'Responda algumas perguntas e receba um plano personalizado para sua rotina em menos de 2 minutos.',
}

/**
 * Só o título e a introdução mudam com o tema. As perguntas, o diagnóstico e
 * o plano são os mesmos: o tema é a continuação da conversa do carrossel,
 * não um quiz diferente.
 */
export const QUIZ_INTROS: Readonly<Record<QuizThemeKey, QuizIntro>> = {
  procrastinacao: {
    title: 'Pare de adiar. Comece com um passo que cabe hoje.',
    description:
      'Responda algumas perguntas e receba um plano com o primeiro passo pequeno o bastante pra você não empurrar pra amanhã.',
  },
  constancia: {
    title: 'Pare de recomeçar toda segunda-feira.',
    description:
      'Responda algumas perguntas e receba um plano que continua funcionando na semana em que a rotina não sai como o planejado.',
  },
  tempo: {
    title: 'Sua meta cabe no tempo que você tem.',
    description:
      'Responda algumas perguntas e receba um plano montado em cima dos minutos e dos dias que você tem de verdade.',
  },
  comeco: {
    title: 'Você sabe o que quer. Falta saber por onde começar.',
    description:
      'Responda algumas perguntas e receba sua meta dividida em etapas, com o primeiro passo pronto pra hoje.',
  },
  foco: {
    title: 'Uma meta de cada vez, com um plano possível.',
    description:
      'Responda algumas perguntas e receba um plano com prioridade clara, no lugar de uma lista que não termina.',
  },
}

export function isQuizTheme(value: string | null | undefined): value is QuizThemeKey {
  return value !== null && value !== undefined && (QUIZ_THEMES as readonly string[]).includes(value)
}

export function quizIntro(theme: QuizThemeKey | null): QuizIntro {
  return theme ? QUIZ_INTROS[theme] : DEFAULT_QUIZ_INTRO
}

// ---------------------------------------------------------------------------
// o diagnóstico
// ---------------------------------------------------------------------------

export interface QuizDiagnosis {
  /** "Seu perfil de execução: ..." */
  readonly profile: string
  readonly goal: string
  readonly obstacle: string
  readonly time: string
  /** O estilo de execução recomendado, já resolvido quando a pessoa deixou o app decidir. */
  readonly style: QuizStyleKey
  readonly styleLabel: string
  /** A explicação curta, montada com as respostas. */
  readonly explanation: string
}

interface ObstacleReading {
  /** O perfil quando o tempo é curto e quando é maior. */
  readonly profile: readonly [short: string, long: string]
  readonly recommendedStyle: QuizStyleKey
  readonly explain: (ctx: DiagnosisContext) => string
}

interface DiagnosisContext {
  readonly goal: string
  readonly minutes: string
  readonly days: number
}

const READINGS: Readonly<Record<QuizObstacleKey, ObstacleReading>> = {
  procrastino: {
    profile: ['Sabe o que quer, trava na largada', 'Tem tempo, trava na largada'],
    recommendedStyle: 'passos_pequenos',
    explain: ({ goal, minutes }) =>
      `Você não precisa de mais disciplina. Precisa de um primeiro passo tão pequeno que não dê pra adiar: ${minutes} pra ${goal}, começando hoje, e o próximo já decidido antes de você parar.`,
  },
  abandono: {
    profile: ['Começa forte, perde o fio', 'Começa forte, perde o fio no meio'],
    recommendedStyle: 'metas_semanais',
    explain: ({ goal, days }) =>
      `Você não tem problema pra começar, tem problema pra continuar. O plano pra ${goal} vai ser medido por semana, em ${days} ${days === 1 ? 'dia' : 'dias'}, com marcos curtos o bastante pra você ver progresso antes de desanimar.`,
  },
  pouco_tempo: {
    profile: ['Ambição alta, rotina apertada', 'Ambição alta, agenda cheia'],
    recommendedStyle: 'passos_pequenos',
    explain: ({ goal, minutes, days }) =>
      `Você não precisa de mais metas. Precisa de ações menores, prioridade clara e um plano que caiba em ${minutes} nos ${days} ${days === 1 ? 'dia' : 'dias'} que você tem, e continue funcionando quando a rotina mudar. É assim que ${goal} sai do papel.`,
  },
  sem_comeco: {
    profile: ['Meta clara, caminho embaçado', 'Meta clara, caminho ainda embaçado'],
    recommendedStyle: 'rotina_definida',
    explain: ({ goal }) =>
      `Você não está travando por falta de vontade. Está travando porque ${goal} ainda é um bloco só. Dividido em três marcos, com a primeira ação já escolhida, o começo deixa de ser uma decisão.`,
  },
  rotina_muda: {
    profile: ['Constante na intenção, instável na agenda', 'Intenção firme, agenda imprevisível'],
    recommendedStyle: 'liberdade',
    explain: ({ goal, minutes }) =>
      `Seu problema não é constância, é um plano rígido demais pra uma rotina que muda. O plano pra ${goal} tem versão mínima em cada ação: nos dias cheios, ${minutes} viram cinco, e a sequência não quebra.`,
  },
  tudo_ao_mesmo_tempo: {
    profile: ['Muita energia, pouca prioridade', 'Muita energia, prioridade espalhada'],
    recommendedStyle: 'metas_semanais',
    explain: ({ goal }) =>
      `Você não precisa fazer menos. Precisa fazer uma coisa de cada vez. O plano segura ${goal} como o único objetivo por agora, com uma prioridade por dia, e o resto entra quando o primeiro marco fechar.`,
  },
  motivacao: {
    profile: ['Arranca com força, esfria rápido', 'Arranca com força, esfria no meio'],
    recommendedStyle: 'passos_pequenos',
    explain: ({ goal, minutes }) =>
      `Motivação não é combustível, é consequência. O plano pra ${goal} começa com vitórias de ${minutes}, pequenas de propósito, pra você ver progresso antes que a empolgação acabe.`,
  },
}

export function buildDiagnosis(answers: CompleteQuizAnswers): QuizDiagnosis {
  const obstacle = primaryObstacle(answers)
  const reading = READINGS[obstacle]
  const style = answers.style === 'momentumm_decide' ? reading.recommendedStyle : answers.style
  const short = answers.time === '10' || answers.time === '20' || answers.time === 'depende'

  return {
    profile: reading.profile[short ? 0 : 1],
    goal: answers.goal.trim(),
    // Todas as marcadas, a principal primeiro: a pessoa reconhece o que ela mesma disse.
    obstacle: answers.obstacles.map((key) => QUIZ_OBSTACLE_LABELS[key]).join(', '),
    time:
      answers.time === 'depende'
        ? `Depende do dia (o plano usa ${VARIABLE_DAY_MINUTES} minutos como base)`
        : `${QUIZ_TIME_LABELS[answers.time]} por dia`,
    style,
    styleLabel: QUIZ_STYLE_LABELS[style],
    explanation: reading.explain({
      goal: goalPhrase(answers.goal),
      minutes: minutesLabel(answers.time),
      days: answers.weekdays.length,
    }),
  }
}

/** "Lançar meu projeto" vira "lançar meu projeto" no meio de uma frase. */
function goalPhrase(goal: string): string {
  const trimmed = goal.trim().replace(/[.!]+$/, '')
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
}

function minutesLabel(time: QuizTimeKey): string {
  if (time === 'depende') return `${VARIABLE_DAY_MINUTES} minutos`
  if (time === '60') return '1 hora'
  if (time === '90') return '1 hora e pouco'
  return `${time} minutos`
}

// ---------------------------------------------------------------------------
// a ponte pro gerador de plano
// ---------------------------------------------------------------------------

const AREA_TO_LIFE_AREA: Readonly<Record<QuizAreaKey, LifeAreaKey>> = {
  saude: 'saude',
  carreira: 'carreira',
  estudos: 'estudos',
  financas: 'financas',
  pessoal: 'pessoal',
  relacionamentos: 'outro',
  projeto: 'projeto',
  outra: 'outro',
}

export function minutesOf(time: QuizTimeKey): number {
  return time === 'depende' ? VARIABLE_DAY_MINUTES : Number(time)
}

/**
 * "Até o final do ano" é uma data, e no fim de dezembro ela deixa de caber
 * no mínimo do objetivo: aí vale o fim do ano seguinte, que é o que a
 * pessoa quis dizer.
 */
export function horizonOf(key: QuizHorizonKey, today: DayKey): Horizon {
  switch (key) {
    case 'nao_sei':
      return { kind: 'flexivel' }
    case 'fim_do_ano': {
      const year = dayKeyToDate(today).getFullYear()
      const endOfYear = parseDayKey(`${year}-12-31`)
      const date =
        daysBetween(today, endOfYear) + 1 >= MIN_OBJECTIVE_DAYS
          ? endOfYear
          : parseDayKey(`${year + 1}-12-31`)
      return { kind: 'data', date }
    }
    default:
      return { kind: 'preset', days: Number(key) }
  }
}

export function toActivationAnswers(answers: CompleteQuizAnswers, today: DayKey): ActivationAnswers {
  const area = primaryArea(answers)
  const customArea =
    area === 'relacionamentos'
      ? QUIZ_AREA_LABELS.relacionamentos
      : answers.customArea.trim() || 'Minha área'

  /*
    As outras áreas marcadas não viram plano: viram eixo na conta, como no
    onboarding (`extraAreas`). "Relacionamentos" e "Outra" caem no mesmo
    `outro` e dividiriam o `customArea`, então só a principal leva o nome.
  */
  const extraAreas = answers.areas
    .slice(1)
    .map((key) => AREA_TO_LIFE_AREA[key])
    .filter((key) => key !== 'outro')

  return {
    area: AREA_TO_LIFE_AREA[area],
    extraAreas: [...new Set(extraAreas)],
    customArea,
    goal: answers.goal.trim(),
    horizon: horizonOf(answers.horizon, today),
    budget: {
      mode: 'dia',
      minutes: minutesOf(answers.time),
      weekdays: [...answers.weekdays].sort((a, b) => a - b),
    },
  }
}

// ---------------------------------------------------------------------------
// o hábito de sustentação
// ---------------------------------------------------------------------------

export interface QuizHabit {
  readonly name: string
  readonly icon: HabitIcon
  readonly dayPart: DayPart
  readonly weekdays: readonly number[]
  /** Minutos por vez. */
  readonly target: number
  readonly minimalTarget: number
  readonly description: string
}

const HABIT_ICON_BY_AREA: Readonly<Record<QuizAreaKey, HabitIcon>> = {
  saude: 'halter',
  carreira: 'caneta',
  estudos: 'cerebro',
  financas: 'sol',
  pessoal: 'lotus',
  relacionamentos: 'lotus',
  projeto: 'caneta',
  outra: 'sol',
}

/**
 * O hábito que sustenta o plano: uma repetição curta nos dias marcados, com
 * versão mínima de cinco minutos. Ele não mede o objetivo (execução é
 * execução); ele existe pra a pessoa aparecer nos dias combinados.
 */
export function suggestHabit(answers: CompleteQuizAnswers, minutesPerDay: number): QuizHabit {
  const target = Math.max(5, Math.min(minutesPerDay, 30))
  const focus = goalPhrase(answers.goal)
  const nameByStyle: Record<QuizStyleKey, string> = {
    passos_pequenos: `Um passo pequeno pra ${focus}`,
    rotina_definida: `Sessão de ${target} min pra ${focus}`,
    metas_semanais: `Avançar em ${focus}`,
    liberdade: `Dedicar tempo a ${focus}`,
    momentumm_decide: `Um passo pequeno pra ${focus}`,
  }
  const style =
    answers.style === 'momentumm_decide' ? READINGS[primaryObstacle(answers)].recommendedStyle : answers.style

  return {
    name: nameByStyle[style].slice(0, 60),
    icon: HABIT_ICON_BY_AREA[primaryArea(answers)],
    dayPart: 'qualquer',
    weekdays: [...answers.weekdays].sort((a, b) => a - b),
    target,
    minimalTarget: 5,
    description: 'Nos dias cheios, cinco minutos contam. O que importa é aparecer.',
  }
}

// ---------------------------------------------------------------------------
// a prévia do plano
// ---------------------------------------------------------------------------

export interface QuizPlanPreview {
  readonly plan: ActivationPlan
  readonly habit: QuizHabit
  /** "3 dias por semana, 20 minutos por vez". */
  readonly routine: string
  /** O que foi ajustado pra caber. Null quando coube de primeira. */
  readonly adjustmentNote: string | null
}

export interface QuizPlanInput {
  readonly answers: CompleteQuizAnswers
  readonly today: DayKey
  readonly existingAxes: readonly ActivityTypeSlug[]
}

/**
 * O plano da prévia. Quando a ambição não cabe na disponibilidade, o
 * onboarding para e oferece saídas; aqui a primeira saída que faz caber é
 * aplicada sozinha, porque quem ainda não tem conta não vai negociar com um
 * aviso. A nota diz o que mudou, e a pessoa pode voltar e responder de novo.
 */
export function buildQuizPlan(input: QuizPlanInput): QuizPlanPreview {
  const answers = toActivationAnswers(input.answers, input.today)
  const base = { answers, today: input.today, existingAxes: input.existingAxes }

  let plan = buildActivation(base)
  let adjustmentNote: string | null = null

  if (!plan.ready) {
    /*
      A ordem é a do onboarding: reduzir a sessão primeiro (o tempo que a
      pessoa declarou é a verdade), depois esticar o prazo, depois mexer nos
      dias. Só o primeiro remédio que faz o plano caber é aplicado.
    */
    for (const remedy of plan.remedies) {
      if (!remedy.adjustment) continue
      const adjusted = buildActivation({ ...base, adjustment: remedy.adjustment })
      if (!adjusted.ready) continue
      plan = adjusted
      adjustmentNote = adjustmentNoteFor(remedy.key, adjusted, input.today)
      break
    }
  }

  const minutes = plan.plan.minutesPerSession
  const days = plan.budget.daysPerWeek

  return {
    plan,
    habit: suggestHabit(input.answers, minutes),
    routine: `${days} ${days === 1 ? 'dia' : 'dias'} por semana, ${minutes} min por vez`,
    adjustmentNote,
  }
}

/** A nota em linguagem de gente: o que mudou pra o plano caber. */
function adjustmentNoteFor(key: ActivationRemedyKey, plan: ActivationPlan, today: DayKey): string {
  switch (key) {
    case 'reduzir':
      return `Ajustei o tamanho de cada sessão pra caber nos seus ${plan.plan.minutesPerSession} minutos. O objetivo continua, em passos menores.`
    case 'prazo':
      return `Estiquei o prazo até ${formatDayLong(plan.deadline, today)} pra o plano caber na sua rotina.`
    case 'frequencia':
      return `Ajustei pra ${plan.budget.daysPerWeek} ${plan.budget.daysPerWeek === 1 ? 'dia' : 'dias'} por semana pra cada sessão caber no seu tempo.`
    default:
      return 'Ajustei o plano pra caber na sua rotina.'
  }
}

export const WEEKDAY_SHORT: readonly { readonly value: number; readonly label: string }[] = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

/** A data que o plano assume, pra frase "em 90 dias" da prévia. */
export function planDaysOf(plan: ActivationPlan, today: DayKey): number {
  return daysBetween(today, plan.deadline) + 1
}
