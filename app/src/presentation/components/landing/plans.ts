import { PLAN_LIMITS } from '@/domain/entities/plan'

/**
 * Os planos da landing.
 *
 * Os LIMITES vêm do domínio (`PLAN_LIMITS`): quantos objetivos, hábitos,
 * planos, ações por dia e dias de histórico cada plano guarda. Copiar o número
 * aqui faria a landing prometer 5 hábitos no dia em que o app passasse a
 * guardar 3. O que mora neste arquivo é só o que o domínio não sabe: preço,
 * texto e a frase de cada plano.
 *
 * A separação é uma frase: o gratuito ORGANIZA E EXECUTA, o PRO REGISTRA,
 * ANALISA E EVOLUI. A tabela completa (`planMatrix`) fica logo abaixo dos
 * cards; aqui entram só os pontos que decidem.
 *
 * O PRO é um plano só com dois ciclos de cobrança. Dois cards pro mesmo
 * produto dividiam a atenção e escondiam o desconto do anual.
 */

export type BillingCycle = 'mensal' | 'anual'

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
  readonly features: readonly string[]
  readonly cta: string
  readonly highlight?: boolean
}

const free = PLAN_LIMITS.free

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const FREE_PRICE: Price = { amount: 'R$ 0', period: 'para sempre' }

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    badge: 'FREE',
    headline: 'Organize e execute',
    prices: { mensal: FREE_PRICE, anual: FREE_PRICE },
    description:
      'Cria o objetivo, organiza os hábitos, acompanha as ações do dia e vê o teu Momentum Score de hoje. É o ciclo rodando, sem cartão.',
    features: [
      `Até ${plural(free.activeObjectives, 'objetivo ativo', 'objetivos ativos')} e ${plural(free.activeHabits, 'hábito ativo', 'hábitos ativos')}`,
      `${plural(free.activePlans, 'plano ativo', 'planos ativos')} por etapas`,
      `Até ${free.actionsPerDay} ações por dia no Hoje`,
      `Histórico dos últimos ${free.historyDays} dias`,
      'Momentum Score de hoje',
      'Check-in semanal manual',
      'Dia Adaptável e Modo Retomada',
    ],
    cta: 'Começar grátis',
  },
  {
    id: 'pro',
    badge: 'PRO',
    headline: 'Registre, analise e evolua',
    prices: {
      mensal: { amount: 'R$ 39,90', period: '/mês', strike: 'R$ 79,90' },
      anual: {
        amount: 'R$ 179,90',
        period: '/ano',
        strike: 'R$ 358,80',
        note: 'equivale a R$ 14,99/mês',
        savings: 'Economize R$ 178,90',
      },
    },
    description:
      'Entender os próprios padrões, registrar a jornada, ver as métricas e ajustar o plano com a leitura da IA. É a proposta inteira do Momentumm.',
    features: [
      'Tudo do gratuito, sem limite de quantidade',
      'Histórico completo, com a evolução e o detalhamento do score',
      'Review semanal cruzando os teus dados reais',
      'Momentumm AI: plano, gargalos e recomendações',
      'Métricas, relatórios e registros em texto, foto e voz',
      'Compartilhamento com todos os modelos e exportação',
    ],
    cta: 'Começar com PRO',
    highlight: true,
  },
]

/** O que só o anual tem. Aparece no card do PRO quando o ciclo anual está selecionado. */
export const ANNUAL_EXTRAS = [
  'Preço protegido na renovação*',
  'Suporte prioritário, selo de fundador e acesso antecipado',
] as const

export const PRICING_FOOTNOTE =
  '* O preço protegido vale enquanto a assinatura anual não for cancelada. Os recursos do PRO entram conforme forem ficando prontos.'
