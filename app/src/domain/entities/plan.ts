/**
 * Planos.
 *
 * A separação é uma frase: o gratuito ORGANIZA E EXECUTA, o PRO REGISTRA,
 * ANALISA E EVOLUI. Quem está no gratuito cria objetivo, organiza alguns
 * hábitos, acompanha as ações do dia, marca o que concluiu e vê o Momentumm
 * Score de hoje. O que ela não consegue é olhar pra trás com profundidade:
 * evolução do score, métricas, relatórios, análises da IA e a review que cruza
 * os dados reais da semana.
 *
 * A regra de produto continua: o dashboard NÃO é bloqueado por banner. O PRO
 * aparece onde o limite encosta, numa linha, e sai do caminho.
 */

export const PLAN_TIERS = ['free', 'pro'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

export const PLAN_LABELS: Readonly<Record<PlanTier, string>> = {
  free: 'Gratuito',
  pro: 'PRO',
}

export interface PlanLimits {
  readonly tier: PlanTier
  /** Objetivos em andamento ao mesmo tempo (pausado e concluído não contam). */
  readonly activeObjectives: number
  readonly activeHabits: number
  /** Objetivos ativos com plano por etapas. */
  readonly activePlans: number
  /** Ações que cabem num mesmo dia. */
  readonly actionsPerDay: number
  readonly historyDays: number
  /** Evolução e detalhamento do score. Sem isso, só a pontuação de hoje. */
  readonly momentumDetail: boolean
  /** Review cruzando os dados reais. Sem isso, o check-in manual de quatro perguntas. */
  readonly fullReview: boolean
  readonly ai: boolean
  /** Métricas detalhadas de período: últimos 7 dias, mês, comparação. */
  readonly metrics: boolean
  readonly reports: boolean
  /** Registros em texto (a nota do registro de atividade). */
  readonly textLogs: boolean
  readonly photoLogs: boolean
  readonly voiceLogs: boolean
  /** Padrões, gargalos e recomendações a partir do histórico. */
  readonly aiAnalysis: boolean
  readonly objectiveTemplates: number
  /** Modelos de card no compartilhamento. Um só no gratuito. */
  readonly shareTemplates: number
  readonly shareCustomization: boolean
  readonly dataExport: boolean
  readonly remindersPerHabit: number
  readonly themes: boolean
  /** Chamadas à Momentumm AI por mês (a franquia). O teto é aplicado no servidor. */
  readonly aiCallsPerMonth: number
  /**
   * Quantas pessoas cabem no Círculo ao mesmo tempo.
   *
   * No gratuito é UMA: a dupla. Acompanhar o progresso de uma pessoa é o que
   * faz alguém voltar no dia em que a motivação não veio, e uma dupla entrega
   * isso inteiro. Rede grande é outra coisa, e é do PRO.
   *
   * Conta convite enviado junto com amizade aceita: senão dava pra disparar
   * dez convites e acordar com dez pessoas no Círculo gratuito.
   */
  readonly circleFriends: number
}

const UNLIMITED = Number.POSITIVE_INFINITY

export const PLAN_LIMITS: Readonly<Record<PlanTier, PlanLimits>> = {
  free: {
    tier: 'free',
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
    circleFriends: 1,
    shareTemplates: 3,
    shareCustomization: false,
    dataExport: false,
    remindersPerHabit: 1,
    themes: false,
    aiCallsPerMonth: 0,
  },
  pro: {
    tier: 'pro',
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
    circleFriends: UNLIMITED,
    shareTemplates: UNLIMITED,
    shareCustomization: true,
    dataExport: true,
    remindersPerHabit: UNLIMITED,
    themes: true,
    aiCallsPerMonth: 150,
  },
}

export function limitsOf(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier]
}

export function isPro(tier: PlanTier): boolean {
  return tier === 'pro'
}

export function isUnlimited(max: number): boolean {
  return !Number.isFinite(max)
}

export interface LimitCheck {
  readonly reached: boolean
  readonly used: number
  readonly max: number
  /** Frase curta e contextual pro ponto exato onde o limite aparece. */
  readonly message: string | null
}

export function checkLimit(used: number, max: number, what: string): LimitCheck {
  const reached = used >= max
  return {
    reached,
    used,
    max,
    message: reached ? `O plano gratuito guarda até ${max} ${what} ao mesmo tempo.` : null,
  }
}

export function formatLimit(max: number): string {
  return isUnlimited(max) ? 'ilimitado' : String(max)
}

/**
 * A matriz inteira, linha a linha, do jeito que a landing e o perfil mostram.
 * Sai do domínio pra tabela nunca prometer um número diferente do que o app
 * aplica.
 */
export interface PlanMatrixRow {
  readonly feature: string
  readonly free: string
  readonly pro: string
}

function count(max: number, singular: string, plural: string): string {
  if (isUnlimited(max)) return `${plural.charAt(0).toUpperCase()}${plural.slice(1)} ilimitados`
  return `Até ${max} ${max === 1 ? singular : plural}`
}

export function planMatrix(): readonly PlanMatrixRow[] {
  const free = PLAN_LIMITS.free
  return [
    { feature: 'Objetivos ativos', free: count(free.activeObjectives, 'objetivo', 'objetivos'), pro: 'Ilimitados' },
    { feature: 'Hábitos ativos', free: count(free.activeHabits, 'hábito', 'hábitos'), pro: 'Ilimitados' },
    { feature: 'Planos ativos', free: String(free.activePlans), pro: 'Ilimitados' },
    { feature: 'Ações no Hoje', free: `Até ${free.actionsPerDay} por dia`, pro: 'Ilimitadas' },
    { feature: 'Histórico', free: `Últimos ${free.historyDays} dias`, pro: 'Histórico completo' },
    { feature: 'Momentumm Score', free: 'Apenas pontuação atual', pro: 'Pontuação, evolução e detalhamento' },
    { feature: 'Review semanal', free: 'Check-in básico manual', pro: 'Review completo e personalizado' },
    { feature: 'Momentumm AI', free: 'Não disponível', pro: `Franquia mensal (${PLAN_LIMITS.pro.aiCallsPerMonth} leituras)` },
    { feature: 'Métricas', free: 'Não disponível', pro: 'Métricas detalhadas' },
    { feature: 'Relatórios', free: 'Não disponível', pro: 'Semanais e mensais' },
    { feature: 'Registros em texto', free: 'Não disponível', pro: 'Disponível' },
    { feature: 'Fotos nos registros', free: 'Não disponível', pro: 'Disponível com limite' },
    { feature: 'Registros por voz', free: 'Não disponível', pro: 'Disponível com limite mensal' },
    { feature: 'Análises de IA', free: 'Não disponível', pro: 'Padrões, gargalos e recomendações' },
    { feature: 'Círculo', free: count(free.circleFriends, 'pessoa', 'pessoas'), pro: 'Ilimitado' },
    { feature: 'Templates de objetivos', free: `Até ${free.objectiveTemplates} templates básicos`, pro: 'Biblioteca completa' },
    { feature: 'Compartilhamento', free: `${free.shareTemplates} arranjos, todas as cores e PNG`, pro: 'Todos os modelos e personalização' },
    { feature: 'Exportação de dados', free: 'Não disponível', pro: 'PDF, imagem e CSV' },
    { feature: 'Lembretes', free: `${free.remindersPerHabit} lembrete por hábito`, pro: 'Lembretes personalizados' },
    { feature: 'Personalização', free: 'Tema padrão', pro: 'Temas, cores e preferências' },
  ]
}
