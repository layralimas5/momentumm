import { addDays, dayKeyToDate, type DayKey } from './day'
import {
  QUIZ_HISTORY_LABELS,
  QUIZ_OBSTACLE_LABELS,
  QUIZ_STYLE_LABELS,
  QUIZ_TIME_LABELS,
  minutesOf,
  primaryObstacle,
  type CompleteQuizAnswers,
  type QuizAreaContext,
  type QuizHistoryKey,
  type QuizObstacleKey,
  type QuizPlanPreview,
  type QuizStyleKey,
  type QuizTimeKey,
} from './quiz'

/**
 * A estratégia do resultado do quiz: o que entendemos sobre a pessoa e como
 * o Momentumm vai agir, as duas coisas tiradas SÓ das respostas.
 *
 * ## A regra que manda neste arquivo
 *
 * Nada de número que o sistema não tem como saber. Sem "96% de chance", sem
 * arquétipo, sem curva projetada. A percepção de inteligência vem de a
 * recomendação acertar o ponto onde a pessoa costuma falhar, e de ela
 * conseguir ver de qual resposta cada recomendação saiu.
 *
 * Por isso o caminho é determinístico e auditável:
 *
 *   respostas → sinais (tabelas abaixo) → perfil → padrão + indicadores
 *             → regras → três intervenções, cada uma com o porquê
 *
 * Os pontos do perfil são parâmetros internos de personalização. Eles nunca
 * aparecem como número na tela: viram "Fácil / Moderado / Difícil" e a
 * frase que cita a resposta. A IA pode reescrever a copy depois; quem escolhe
 * a intervenção continua sendo a regra.
 *
 * ## A base por trás das intervenções (não vai pra interface)
 *
 * - Monitorar o progresso aumenta o alcance de metas (Harkin et al., 2016,
 *   Psychological Bulletin, 138 estudos, doi:10.1037/bul0000025):
 *   `progress_tracking`, `weekly_review`.
 * - Planos "se → então" decididos antes do obstáculo (Gollwitzer & Sheeran,
 *   2006, meta-análise de 94 testes): `implementation_intention`,
 *   `recovery_plan`, `habit_anchor`.
 * - Perder uma oportunidade isolada não prejudicou de forma relevante a
 *   formação do hábito (Lally et al., 2010, European Journal of Social
 *   Psychology, doi:10.1002/ejsp.674): `minimum_action`, `recovery_plan` e a
 *   regra de copy "um dia perdido não zera nada".
 * - Meta sozinha não garante execução (Epton et al., 2017, meta-análise de
 *   goal setting): objetivo → marco → ação → momento → acompanhamento, que é
 *   o `graded_task` e o `daily_priority`.
 */

// ---------------------------------------------------------------------------
// o perfil
// ---------------------------------------------------------------------------

export const BEHAVIOR_DIMENSIONS = [
  'startingDifficulty',
  'consistencyDifficulty',
  'recoveryDifficulty',
  'overloadRisk',
  'planningDifficulty',
  'progressVisibilityNeed',
] as const
export type BehaviorDimension = (typeof BEHAVIOR_DIMENSIONS)[number]

/** A partir daqui o sinal é forte o bastante pra escolher uma intervenção sozinho. */
export const HIGH = 3
const MEDIUM = 1

type Signals = Partial<Record<BehaviorDimension, number>>

/** Uma resposta que pesou no perfil, guardada pra a tela poder citar. */
export interface ProfileEvidence {
  readonly source: 'obstacle' | 'history' | 'time' | 'style'
  /** O texto exato da opção que a pessoa tocou. */
  readonly answer: string
  readonly signals: Signals
}

export interface BehaviorProfile extends Readonly<Record<BehaviorDimension, number>> {
  readonly availableMinutes: number
  readonly availableTime: QuizTimeKey
  readonly preferredSupport: QuizStyleKey
  readonly mainGoal: string
  readonly evidence: readonly ProfileEvidence[]
}

/*
  As tabelas de sinal. São o coração auditável do motor: dá pra ler daqui
  por que uma resposta puxou uma recomendação, sem abrir função nenhuma.
*/

const OBSTACLE_SIGNALS: Readonly<Record<QuizObstacleKey, Signals>> = {
  procrastino: { startingDifficulty: 3 },
  sem_comeco: { startingDifficulty: 2, planningDifficulty: 2 },
  abandono: { consistencyDifficulty: 3, recoveryDifficulty: 1, progressVisibilityNeed: 1 },
  motivacao: { consistencyDifficulty: 2, progressVisibilityNeed: 3 },
  rotina_muda: { recoveryDifficulty: 3, overloadRisk: 1 },
  pouco_tempo: { overloadRisk: 3, consistencyDifficulty: 1 },
  tudo_ao_mesmo_tempo: { planningDifficulty: 3, overloadRisk: 1 },
}

const HISTORY_SIGNALS: Readonly<Record<QuizHistoryKey, Signals>> = {
  primeira: { startingDifficulty: 1 },
  algumas: { consistencyDifficulty: 1, recoveryDifficulty: 1 },
  perdi_a_conta: { recoveryDifficulty: 2, consistencyDifficulty: 1 },
  // Já manteve: o que faltou foi voltar depois que a rotina saiu do eixo.
  mantive_e_parei: { recoveryDifficulty: 2 },
}

const TIME_SIGNALS: Readonly<Partial<Record<QuizTimeKey, Signals>>> = {
  '10': { overloadRisk: 1 },
  depende: { recoveryDifficulty: 1 },
}

const STYLE_SIGNALS: Readonly<Partial<Record<QuizStyleKey, Signals>>> = {
  metas_semanais: { progressVisibilityNeed: 1 },
  momentumm_decide: { planningDifficulty: 1 },
}

/** A dificuldade marcada primeiro pesa um ponto a mais na dimensão principal dela. */
const PRIMARY_BONUS = 1

export function buildBehaviorProfile(answers: CompleteQuizAnswers): BehaviorProfile {
  const evidence: ProfileEvidence[] = []
  const primary = primaryObstacle(answers)

  for (const key of answers.obstacles) {
    const base = OBSTACLE_SIGNALS[key]
    const signals = key === primary ? withPrimaryBonus(base) : base
    evidence.push({ source: 'obstacle', answer: QUIZ_OBSTACLE_LABELS[key], signals })
  }
  if (answers.history) {
    evidence.push({ source: 'history', answer: QUIZ_HISTORY_LABELS[answers.history], signals: HISTORY_SIGNALS[answers.history] })
  }
  const timeSignals = TIME_SIGNALS[answers.time]
  if (timeSignals) evidence.push({ source: 'time', answer: QUIZ_TIME_LABELS[answers.time], signals: timeSignals })
  const styleSignals = STYLE_SIGNALS[answers.style]
  if (styleSignals) evidence.push({ source: 'style', answer: QUIZ_STYLE_LABELS[answers.style], signals: styleSignals })

  const totals = Object.fromEntries(BEHAVIOR_DIMENSIONS.map((dimension) => [dimension, 0])) as Record<
    BehaviorDimension,
    number
  >
  for (const item of evidence) {
    for (const dimension of BEHAVIOR_DIMENSIONS) totals[dimension] += item.signals[dimension] ?? 0
  }

  return {
    ...totals,
    availableMinutes: minutesOf(answers.time),
    availableTime: answers.time,
    preferredSupport: answers.style,
    mainGoal: answers.goal.trim(),
    evidence,
  }
}

function withPrimaryBonus(signals: Signals): Signals {
  const strongest = strongestDimension(signals)
  if (!strongest) return signals
  return { ...signals, [strongest]: (signals[strongest] ?? 0) + PRIMARY_BONUS }
}

function strongestDimension(signals: Signals): BehaviorDimension | null {
  let best: BehaviorDimension | null = null
  for (const dimension of BEHAVIOR_DIMENSIONS) {
    if ((signals[dimension] ?? 0) > (best ? (signals[best] ?? 0) : 0)) best = dimension
  }
  return best
}

/** As respostas que puxaram estas dimensões, na ordem em que a pessoa respondeu. */
export function evidenceFor(profile: BehaviorProfile, dimensions: readonly BehaviorDimension[]): readonly string[] {
  const answers = profile.evidence
    .filter((item) => dimensions.some((dimension) => (item.signals[dimension] ?? 0) > 0))
    .map((item) => item.answer)
  return [...new Set(answers)]
}

// ---------------------------------------------------------------------------
// o padrão
// ---------------------------------------------------------------------------

type PatternDimension = Exclude<BehaviorDimension, 'progressVisibilityNeed'>

/** O desempate quando duas dimensões empatam e nenhuma é a da dificuldade principal. */
const PATTERN_ORDER: readonly PatternDimension[] = [
  'recoveryDifficulty',
  'consistencyDifficulty',
  'startingDifficulty',
  'overloadRisk',
  'planningDifficulty',
]

export interface QuizPattern {
  readonly dimension: PatternDimension
  readonly headline: string
  readonly body: string
  /** As respostas que sustentam a frase, pra tela dizer "com base em". */
  readonly evidence: readonly string[]
}

const PATTERN_COPY: Readonly<Record<PatternDimension, { readonly headline: string; readonly body: string }>> = {
  recoveryDifficulty: {
    headline: 'Você começa forte, mas perde ritmo quando o dia sai do plano.',
    body: 'Seu principal risco não parece ser falta de vontade. Pelas suas respostas, o problema aparece quando um imprevisto quebra a rotina e fica difícil retomar.',
  },
  consistencyDifficulty: {
    headline: 'Você começa bem, mas o ritmo cai antes de virar rotina.',
    body: 'Começar não é o problema. Pelas suas respostas, a dificuldade aparece depois das primeiras vezes, quando o esforço continua e o resultado ainda não dá pra ver.',
  },
  startingDifficulty: {
    headline: 'Você sabe o que quer, mas trava na hora de começar.',
    body: 'Não parece ser falta de vontade. Pelas suas respostas, o primeiro passo ainda está grande ou indefinido demais, e o que é indefinido fica pra depois.',
  },
  overloadRisk: {
    headline: 'Você quer avançar, mas o plano costuma ser maior que o seu dia.',
    body: 'Pelas suas respostas, o que derruba a constância é o tamanho do compromisso, não a falta de interesse. Quando o dia aperta, um plano grande vira tudo ou nada.',
  },
  planningDifficulty: {
    headline: 'Você tem energia, mas ela se espalha em muitas frentes.',
    body: 'Pelas suas respostas, o problema não é fazer pouco. É começar muitas coisas ao mesmo tempo, e nenhuma ganhar ritmo pra ir até o fim.',
  },
}

export function buildPattern(profile: BehaviorProfile, primary: QuizObstacleKey): QuizPattern {
  const primaryDimension = strongestDimension(OBSTACLE_SIGNALS[primary])
  const dimension = PATTERN_ORDER.reduce((best, candidate) => {
    const diff = profile[candidate] - profile[best]
    if (diff > 0) return candidate
    if (diff === 0 && candidate === primaryDimension) return candidate
    return best
  })
  return { dimension, ...PATTERN_COPY[dimension], evidence: evidenceFor(profile, [dimension]) }
}

// ---------------------------------------------------------------------------
// os três indicadores: começar, manter, retomar
// ---------------------------------------------------------------------------

export type IndicatorLevel = 'facil' | 'moderado' | 'dificil'
export type IndicatorTag = 'ponto_forte' | 'atencao' | 'principal_desafio'

export const INDICATOR_LEVEL_LABELS: Readonly<Record<IndicatorLevel, string>> = {
  facil: 'Fácil',
  moderado: 'Moderado',
  dificil: 'Difícil',
}

export const INDICATOR_TAG_LABELS: Readonly<Record<IndicatorTag, string>> = {
  ponto_forte: 'Ponto forte',
  atencao: 'Atenção',
  principal_desafio: 'Principal desafio',
}

export interface QuizIndicator {
  readonly dimension: BehaviorDimension
  readonly label: 'Começar' | 'Manter' | 'Retomar'
  readonly level: IndicatorLevel
  readonly tag: IndicatorTag
  /** De onde saiu, em frase. Sem resposta que pese aqui, a frase diz isso. */
  readonly reason: string
}

const INDICATOR_DIMENSIONS = [
  { dimension: 'startingDifficulty', label: 'Começar' },
  { dimension: 'consistencyDifficulty', label: 'Manter' },
  { dimension: 'recoveryDifficulty', label: 'Retomar' },
] as const

function levelOf(points: number): IndicatorLevel {
  if (points >= HIGH) return 'dificil'
  if (points >= MEDIUM) return 'moderado'
  return 'facil'
}

export function buildIndicators(profile: BehaviorProfile, pattern: QuizPattern): readonly QuizIndicator[] {
  // O principal desafio é um só: o do padrão quando ele é um dos três, senão o mais pesado dos três.
  const ranked = [...INDICATOR_DIMENSIONS].sort((a, b) => profile[b.dimension] - profile[a.dimension])
  const top = INDICATOR_DIMENSIONS.find((item) => item.dimension === pattern.dimension) ?? ranked[0]
  const principal = top && profile[top.dimension] >= HIGH ? top.dimension : null

  return INDICATOR_DIMENSIONS.map(({ dimension, label }) => {
    const points = profile[dimension]
    const level = levelOf(points)
    const tag: IndicatorTag =
      dimension === principal ? 'principal_desafio' : level === 'facil' ? 'ponto_forte' : 'atencao'
    const evidence = evidenceFor(profile, [dimension])
    return {
      dimension,
      label,
      level,
      tag,
      reason:
        evidence.length > 0
          ? `Veio de: ${quoted(evidence)}.`
          : 'Nenhuma resposta sua apontou trava aqui.',
    }
  })
}

// ---------------------------------------------------------------------------
// a biblioteca de intervenções e o motor
// ---------------------------------------------------------------------------

export const INTERVENTIONS = [
  'recovery_plan',
  'minimum_action',
  'progress_tracking',
  'implementation_intention',
  'daily_priority',
  'graded_task',
  'habit_anchor',
  'weekly_review',
] as const
export type InterventionKey = (typeof INTERVENTIONS)[number]

/**
 * Um plano "se → então". É a estrutura que a IA vai poder gerar e o app vai
 * poder disparar depois: o gatilho é a situação, a ação é o mínimo combinado.
 * Os dois lados vêm sem o "se" e o "então", que são da tela (`ifThenSentence`).
 */
export interface IfThenRule {
  readonly when: string
  readonly then: string
}

export function ifThenSentence(rule: IfThenRule): string {
  return `Se ${rule.when}, então ${rule.then}`
}

export type InterventionDetail =
  | { readonly kind: 'shrink'; readonly from: string; readonly fromMinutes: number | null; readonly to: string }
  | { readonly kind: 'if_then'; readonly rule: IfThenRule }
  | { readonly kind: 'streak'; readonly days: readonly ('feito' | 'perdido')[]; readonly caption: string }
  | { readonly kind: 'steps'; readonly steps: readonly string[] }
  | { readonly kind: 'note'; readonly text: string }

export interface Intervention {
  readonly key: InterventionKey
  readonly title: string
  /** A promessa em uma frase. Só o que o app faz de verdade. */
  readonly promise: string
  readonly detail: InterventionDetail
  /** "Por que o Momentumm escolheu isso", citando a resposta. */
  readonly reason: string
}

interface StrategyContext {
  readonly answers: CompleteQuizAnswers
  readonly profile: BehaviorProfile
  readonly preview: QuizPlanPreview
  readonly area: QuizAreaContext
  readonly today: DayKey
}

interface InterventionRule {
  /** O quanto a regra se aplica. A partir de `HIGH` ela entra sozinha. */
  readonly relevance: (profile: BehaviorProfile, answers: CompleteQuizAnswers) => number
  /** As dimensões que a justificam, pra citar as respostas certas. */
  readonly basis: readonly BehaviorDimension[]
  readonly build: (ctx: StrategyContext) => Omit<Intervention, 'key' | 'reason'>
  /** O fim da frase do porquê, depois de citar as respostas. */
  readonly rationale: string
  /** O porquê quando ela entrou por ser a base de todo plano, não por um sinal. */
  readonly baseReason: string
}

const RULES: Readonly<Record<InterventionKey, InterventionRule>> = {
  recovery_plan: {
    relevance: (p) => p.recoveryDifficulty,
    basis: ['recoveryDifficulty'],
    rationale: 'Por isso seu plano prioriza um jeito de voltar depois de um dia perdido, em vez de simplesmente aumentar suas metas.',
    baseReason: 'Todo plano tem dias que não saem. Ter o próximo passo combinado antes evita que um dia perdido vire recomeço.',
    build: (ctx) => ({
      title: 'Plano de retomada',
      promise: 'Se você perder um dia, não recomeça do zero. O Momentumm reorganiza o próximo passo.',
      detail: { kind: 'if_then', rule: recoveryRule(ctx) },
    }),
  },
  minimum_action: {
    relevance: (p) => Math.max(p.overloadRisk, p.recoveryDifficulty - 1),
    basis: ['overloadRisk', 'recoveryDifficulty'],
    rationale: 'Por isso, nos dias ruins, seu plano encolhe em vez de sumir.',
    baseReason: 'Todo passo do seu plano já nasce com uma versão menor, pra um dia cheio não virar dia zerado.',
    build: (ctx) => {
      const step = ctx.preview.plan.firstStep
      return {
        title: 'Passo mínimo',
        promise: 'Nos dias ruins, sua meta não desaparece. Ela diminui.',
        detail: {
          kind: 'shrink',
          from: step?.title ?? `${ctx.profile.availableMinutes} min pra ${ctx.area.practice}`,
          fromMinutes: step?.estimatedMin ?? ctx.profile.availableMinutes,
          to: step?.minimalVersion ?? capitalize(ctx.area.minimalExample),
        },
      }
    },
  },
  progress_tracking: {
    relevance: (p) => Math.max(p.progressVisibilityNeed, p.consistencyDifficulty - 1),
    basis: ['progressVisibilityNeed', 'consistencyDifficulty'],
    rationale: 'Por isso o plano mostra a evolução desde a primeira semana, incluindo as retomadas.',
    baseReason: 'Ver o que já foi feito é uma das formas mais consistentes de continuar. Por isso todo plano registra a evolução, não só a lista.',
    build: () => ({
      title: 'Progresso visível',
      promise: 'Você vê evolução, não só tarefas concluídas. Retomar também conta.',
      detail: {
        kind: 'streak',
        days: ['feito', 'feito', 'feito', 'perdido', 'feito'],
        caption: 'Você perdeu 1 dia e retomou no seguinte. Isso também é progresso.',
      },
    }),
  },
  implementation_intention: {
    relevance: (p) => p.startingDifficulty,
    basis: ['startingDifficulty'],
    rationale: 'Por isso a decisão de começar já fica tomada antes de a hora chegar.',
    baseReason: 'Decidir antes o que fazer quando a vontade de adiar aparecer tira essa decisão do momento mais difícil.',
    build: (ctx) => ({
      title: 'Começo decidido',
      promise: 'Quando a vontade de adiar aparecer, a resposta já está combinada.',
      detail: {
        kind: 'if_then',
        rule: {
          when: 'chegar a hora e der vontade de deixar pra depois',
          then: `faço só os primeiros 2 minutos: ${lowerFirst(ctx.preview.plan.firstStep?.minimalVersion ?? ctx.area.minimalExample)}.`,
        },
      },
    }),
  },
  daily_priority: {
    relevance: (p, answers) => (answers.obstacles.includes('tudo_ao_mesmo_tempo') ? p.planningDifficulty : 0),
    basis: ['planningDifficulty'],
    rationale: 'Por isso seu plano segura uma meta e uma prioridade por dia, e o resto espera.',
    baseReason: 'Uma prioridade por dia é o que impede o plano de virar uma lista que não termina.',
    build: (ctx) => ({
      title: 'Uma prioridade por dia',
      promise: 'O dia tem uma coisa que faz ele valer. O resto entra quando o primeiro marco fechar.',
      detail: {
        kind: 'note',
        text: `Hoje: ${ctx.preview.plan.firstStep?.title ?? ctx.preview.plan.objectiveTitle}. Só isso já conta.`,
      },
    }),
  },
  graded_task: {
    relevance: (p, answers) => (answers.obstacles.includes('sem_comeco') ? p.planningDifficulty + 1 : 0),
    basis: ['planningDifficulty', 'startingDifficulty'],
    rationale: 'Por isso sua meta já vem dividida em degraus, e você só precisa enxergar o próximo.',
    baseReason: 'Meta grande sem degraus trava. Por isso todo plano vem dividido em marcos.',
    build: (ctx) => ({
      title: 'Meta em degraus',
      promise: 'Você não precisa saber o caminho inteiro. Só o próximo degrau.',
      detail: { kind: 'steps', steps: ctx.preview.plan.milestones.map((stage) => stage.title) },
    }),
  },
  habit_anchor: {
    relevance: (p, answers) => (answers.style === 'rotina_definida' ? HIGH : p.startingDifficulty - 1),
    basis: ['startingDifficulty'],
    rationale: 'Por isso o passo ganha um lugar fixo no seu dia, colado em algo que você já faz.',
    baseReason: 'Repetir no mesmo contexto é o que transforma esforço em hábito.',
    build: (ctx) => ({
      title: 'Âncora na rotina',
      promise: 'O passo ganha um lugar fixo no seu dia, logo depois de algo que você já faz.',
      detail: {
        kind: 'if_then',
        rule: {
          when: 'terminar algo que já faço todo dia (o café, chegar em casa)',
          then: `emendo ${ctx.preview.habit.target} min pra ${ctx.area.practice}.`,
        },
      },
    }),
  },
  weekly_review: {
    relevance: (p, answers) =>
      answers.style === 'metas_semanais' ? HIGH : answers.style === 'liberdade' ? HIGH - 1 : p.consistencyDifficulty - 2,
    basis: ['consistencyDifficulty', 'progressVisibilityNeed'],
    rationale: 'Por isso a semana seguinte nasce do que aconteceu nesta, e não de um plano fixo.',
    baseReason: 'Olhar a semana que passou é o que deixa o plano do tamanho certo pra próxima.',
    build: () => ({
      title: 'Ajuste semanal',
      promise: 'No fim da semana, você vê o que funcionou e o plano se ajusta.',
      detail: {
        kind: 'note',
        text: 'O que saiu, o que travou e o tamanho certo da próxima semana. Quatro perguntas, dois minutos.',
      },
    }),
  },
}

/** Quando os sinais não escolhem três, o plano completa com a base que vale pra todo mundo. */
const FALLBACK: readonly InterventionKey[] = ['minimum_action', 'progress_tracking', 'recovery_plan']

export const STRATEGY_SIZE = 3

export function selectInterventions(profile: BehaviorProfile, answers: CompleteQuizAnswers): readonly InterventionKey[] {
  const triggered = INTERVENTIONS.map((key, order) => ({ key, order, relevance: RULES[key].relevance(profile, answers) }))
    .filter((item) => item.relevance >= HIGH)
    .sort((a, b) => b.relevance - a.relevance || a.order - b.order)
    .map((item) => item.key)

  const chosen = triggered.slice(0, STRATEGY_SIZE)
  for (const key of FALLBACK) {
    if (chosen.length >= STRATEGY_SIZE) break
    if (!chosen.includes(key)) chosen.push(key)
  }
  return chosen
}

function buildIntervention(key: InterventionKey, ctx: StrategyContext): Intervention {
  const rule = RULES[key]
  const triggered = rule.relevance(ctx.profile, ctx.answers) >= HIGH
  const evidence = evidenceFor(ctx.profile, rule.basis)
  const reason =
    triggered && evidence.length > 0
      ? `No quiz, você respondeu ${quoted(evidence)}. ${rule.rationale}`
      : rule.baseReason
  return { key, ...rule.build(ctx), reason }
}

// ---------------------------------------------------------------------------
// a estratégia inteira
// ---------------------------------------------------------------------------

export interface QuizStrategy {
  readonly profile: BehaviorProfile
  readonly pattern: QuizPattern
  readonly indicators: readonly QuizIndicator[]
  readonly interventions: readonly Intervention[]
  /** Os "se → então" do plano, prontos pra IA e pros lembretes usarem depois. */
  readonly ifThenRules: readonly IfThenRule[]
}

export function buildQuizStrategy(input: {
  readonly answers: CompleteQuizAnswers
  readonly preview: QuizPlanPreview
  readonly area: QuizAreaContext
  readonly today: DayKey
}): QuizStrategy {
  const profile = buildBehaviorProfile(input.answers)
  const pattern = buildPattern(profile, primaryObstacle(input.answers))
  const ctx: StrategyContext = { ...input, profile }
  const interventions = selectInterventions(profile, input.answers).map((key) => buildIntervention(key, ctx))

  return {
    profile,
    pattern,
    indicators: buildIndicators(profile, pattern),
    interventions,
    ifThenRules: interventions.flatMap((item) => (item.detail.kind === 'if_then' ? [item.detail.rule] : [])),
  }
}

// ---------------------------------------------------------------------------
// a retomada com os dias reais do plano
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

/**
 * "Se eu perder o passo de hoje, na quarta faço pelo menos X." Os dias são
 * os que a pessoa marcou, a ação é a versão mínima do plano. Nada de
 * horário: o quiz não pergunta, e inventar um seria prometer o que ela
 * não disse.
 */
function recoveryRule(ctx: StrategyContext): IfThenRule {
  const weekdays = ctx.preview.plan.budget.weekdays
  const minimal = lowerFirst(ctx.preview.plan.firstStep?.minimalVersion ?? ctx.area.minimalExample)
  const first = nextPlannedOffset(ctx.today, weekdays, 0)
  const second = first === null ? null : nextPlannedOffset(ctx.today, weekdays, first + 1)

  if (first === null || second === null) {
    return { when: 'eu perder um dia do plano', then: `no dia seguinte faço pelo menos isto: ${minimal}.` }
  }
  return {
    when: `eu perder o passo ${dayPhrase(ctx.today, first, 'de')}`,
    then: `${dayPhrase(ctx.today, second, 'em')} faço pelo menos isto: ${minimal}.`,
  }
}

function nextPlannedOffset(today: DayKey, weekdays: readonly number[], from: number): number | null {
  if (weekdays.length === 0) return null
  for (let offset = from; offset < from + 7; offset += 1) {
    if (weekdays.includes(dayKeyToDate(addDays(today, offset)).getDay())) return offset
  }
  return null
}

function dayPhrase(today: DayKey, offset: number, preposition: 'de' | 'em'): string {
  if (offset === 0) return preposition === 'de' ? 'de hoje' : 'hoje'
  if (offset === 1) return preposition === 'de' ? 'de amanhã' : 'amanhã'
  const day = dayKeyToDate(addDays(today, offset)).getDay()
  const name = WEEKDAY_NAMES[day] ?? 'outro dia'
  const article = day === 0 || day === 6 ? 'o' : 'a'
  if (preposition === 'de') return `d${article} ${name}`
  return `n${article} ${name}`
}

// ---------------------------------------------------------------------------
// texto
// ---------------------------------------------------------------------------

function quoted(answers: readonly string[]): string {
  const marks = answers.map((answer) => `“${answer}”`)
  if (marks.length <= 1) return marks[0] ?? ''
  return `${marks.slice(0, -1).join(', ')} e ${marks[marks.length - 1]}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function lowerFirst(text: string): string {
  const trimmed = text.trim().replace(/[.!]+$/, '')
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
}
