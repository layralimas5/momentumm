/**
 * Os planos da landing.
 *
 * Os RECURSOS e limites vêm do domínio (`planMatrix`): quantos objetivos,
 * hábitos, planos, ações por dia e dias de histórico cada plano guarda.
 * Copiar o número aqui faria a landing prometer 5 hábitos no dia em que o
 * app passasse a guardar 3. O que mora neste arquivo é só o que o domínio
 * não sabe: preço, texto e a frase de cada plano.
 *
 * A separação é uma frase: o gratuito ORGANIZA E EXECUTA, o PRO REGISTRA,
 * ANALISA E EVOLUI.
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
  readonly cta: string
  readonly highlight?: boolean
}

const FREE_PRICE: Price = { amount: 'R$ 0', period: 'para sempre' }

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    badge: 'Grátis',
    headline: 'Organize e execute',
    prices: { mensal: FREE_PRICE, anual: FREE_PRICE },
    cta: 'Começar grátis',
  },
  {
    id: 'pro',
    badge: 'PRO',
    headline: 'Registre, analise e evolua',
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
    cta: 'Começar com PRO',
    highlight: true,
  },
]

/** O que só o anual tem. Vira um bloco no fim da tabela quando o ciclo anual está selecionado. */
export const ANNUAL_EXTRAS = [
  'Preço protegido na renovação*',
  'Suporte prioritário',
  'Selo de fundador no perfil',
  'Acesso antecipado a novidades',
] as const

export const PRICING_FOOTNOTE =
  '* O preço protegido vale enquanto a assinatura anual não for cancelada. Os recursos do PRO entram conforme forem ficando prontos.'
