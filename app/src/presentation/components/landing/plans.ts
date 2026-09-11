import { formatLimit, PLAN_LIMITS } from '@/domain/entities/plan'

/**
 * Os planos da landing.
 *
 * Os LIMITES vêm do domínio (`PLAN_LIMITS`): quantos objetivos, hábitos,
 * dias de histórico e leituras por dia cada plano guarda. Copiar o número
 * aqui faria a landing prometer 5 hábitos no dia em que o app passasse a
 * guardar 3. O que mora neste arquivo é só o que o domínio não sabe: preço,
 * texto e o que o PRO acrescenta além dos limites.
 *
 * O PRO é um plano só com dois ciclos de cobrança. Dois cards pro mesmo
 * produto dividiam a atenção e escondiam o desconto do anual.
 */

export type BillingCycle = 'mensal' | 'anual'

export interface SpecRow {
  readonly label: string
  readonly value: string
}

export interface Price {
  readonly amount: string
  readonly period: string
  readonly strike?: string
  readonly note?: string
  readonly savings?: string
}

export interface PricingPlan {
  readonly id: string
  readonly badge: string
  readonly headline: string
  readonly prices: Readonly<Record<BillingCycle, Price>>
  readonly description: string
  readonly specs: readonly SpecRow[]
  readonly features: readonly string[]
  readonly cta: string
  readonly highlight?: boolean
}

const free = PLAN_LIMITS.free
const pro = PLAN_LIMITS.pro

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** `formatLimit` devolve "ilimitado" em minúscula; a tabela de specs é título. */
function limitLabel(max: number): string {
  const label = formatLimit(max)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function focusLabel(durations: readonly number[]): string {
  return `${durations.join(', ')} min`
}

/** O que o ciclo inteiro entrega em qualquer plano. O PRO não libera o básico. */
const CORE_FEATURES = [
  'Objetivo, plano por etapas, dia e review semanal',
  'Momentum Score com os quatro fatores',
  'Check-in, prioridade principal e versão mínima',
  'Dia Adaptável e Modo Retomada',
  'Momentumm AI pra montar o plano e ler o progresso',
  'Círculo de amigos e desafios, privado por padrão',
] as const

const FREE_PRICE: Price = { amount: 'R$ 0', period: 'para sempre' }

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    badge: 'Grátis',
    headline: 'O ciclo inteiro, sem cartão',
    prices: { mensal: FREE_PRICE, anual: FREE_PRICE },
    description:
      'Tudo que faz o método funcionar. Os limites são de quantidade e profundidade, nunca de acesso a uma tela.',
    specs: [
      { label: 'Objetivos ativos', value: limitLabel(free.activeGoals) },
      { label: 'Hábitos ativos', value: limitLabel(free.activeHabits) },
      { label: 'Histórico', value: `${free.historyDays} dias` },
    ],
    features: [
      ...CORE_FEATURES,
      `${plural(free.insightsPerDay, 'leitura do ritmo', 'leituras do ritmo')} por dia`,
      `Sessões de foco de ${focusLabel(free.focusDurations)}`,
    ],
    cta: 'Começar grátis',
  },
  {
    id: 'pro',
    badge: 'PRO',
    headline: 'Profundidade pra quem já está no ritmo',
    prices: {
      mensal: { amount: 'R$ 29,90', period: '/mês', strike: 'R$ 79,90' },
      anual: {
        amount: 'R$ 179,90',
        period: '/ano',
        strike: 'R$ 358,80',
        note: 'equivale a R$ 14,99/mês',
        savings: 'Economize R$ 178,90',
      },
    },
    description:
      'Sem limite de objetivos e hábitos, histórico completo e as análises que só fazem sentido com mais dados.',
    specs: [
      { label: 'Objetivos ativos', value: limitLabel(pro.activeGoals) },
      { label: 'Hábitos ativos', value: limitLabel(pro.activeHabits) },
      { label: 'Histórico', value: 'Completo' },
    ],
    features: [
      'Tudo do gratuito',
      'Objetivos e hábitos ilimitados',
      'Histórico completo',
      'Leituras do ritmo sem limite diário',
      `Sessões de foco de ${focusLabel(pro.focusDurations)}`,
      'Análise semanal completa, com comparação e leitura por horário',
      'Relatório mensal',
      'Recomendações adaptativas ao seu ritmo',
      'Suporte por e-mail',
    ],
    cta: 'Começar com PRO',
    highlight: true,
  },
]

/** O que só o anual tem. Aparece no card do PRO quando o ciclo anual está selecionado. */
export const ANNUAL_EXTRAS = [
  'Preço protegido na renovação*',
  'Suporte prioritário',
  'Selo de fundador no perfil',
  'Acesso antecipado a novidades',
] as const

export const PRICING_FOOTNOTE =
  '* O preço protegido vale enquanto a assinatura anual não for cancelada. Os recursos do PRO entram conforme forem ficando prontos.'
