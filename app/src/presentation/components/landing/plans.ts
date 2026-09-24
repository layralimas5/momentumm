import {
  formatBRL,
  monthlyEquivalentCents,
  PRO_PRICES,
  type BillingCycle,
} from '@/domain/billing/billing-plans'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { PLAN_LIMITS } from '@/domain/entities/plan'
import { TRIAL_PROMISE_VERIFIED } from './site'

/**
 * Os planos da landing.
 *
 * Os LIMITES vêm do domínio (`PLAN_LIMITS`) e o PREÇO também (`PRO_PRICES`,
 * o mesmo número que a Edge Function manda pro checkout). O que mora neste
 * arquivo é só o texto.
 *
 * A lista é curta de propósito. A versão anterior anunciava registro em foto
 * e voz, relatórios semanais e mensais, exportação em PDF e CSV e temas:
 * quatro promessas que existem como campo em `PLAN_LIMITS` e não existem em
 * nenhuma tela do app. Recurso entra nesta lista quando alguém consegue usar,
 * não quando ganha uma flag.
 *
 * O PRO é um plano só com dois ciclos de cobrança. O anual não tem recurso a
 * mais: é a mesma coisa cobrada de outro jeito.
 */

export type { BillingCycle }

export interface Price {
  readonly amount: string
  readonly period: string
  /** O que custaria pagando mês a mês no mesmo período. Só no anual, e é uma conta, não uma promoção. */
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
const pro = PRO_PRICES

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const FREE_PRICE: Price = { amount: 'R$ 0', period: 'para sempre' }

const FREE_DESCRIPTION = TRIAL_PROMISE_VERIFIED
  ? `Começa com ${TRIAL_DAYS} dias de PRO, sem cartão. Depois o gratuito segue pra sempre.`
  : 'O ciclo inteiro rodando, sem cartão e sem prazo pra decidir.'

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    badge: 'FREE',
    headline: 'Organize e execute',
    prices: { mensal: FREE_PRICE, anual: FREE_PRICE },
    description: FREE_DESCRIPTION,
    features: [
      'Objetivos com plano por etapas e ações',
      'Hábitos com versão mínima e sequência',
      'A tela Hoje, com Dia Adaptável e Modo Retomada',
      'Momentumm Score de hoje',
      `Círculo: convide ${plural(free.circleFriends, 'amigo', 'amigos')} e acompanhem o progresso um do outro`,
      `Limites do gratuito: ${plural(free.activeObjectives, 'objetivo', 'objetivos')}, ${plural(free.activeHabits, 'hábito', 'hábitos')}, ${plural(free.activePlans, 'plano', 'planos')}, ${free.actionsPerDay} ações por dia`,
      `Histórico dos últimos ${free.historyDays} dias`,
    ],
    cta: 'Criar meu plano',
  },
  {
    id: 'pro',
    badge: 'PRO',
    headline: 'Registre, analise e evolua',
    prices: {
      mensal: {
        amount: formatBRL(pro.mensal.amountCents),
        period: '/mês',
      },
      anual: {
        amount: formatBRL(pro.anual.amountCents),
        period: '/ano',
        strike: formatBRL(pro.anual.strikeCents),
        note: `equivale a ${formatBRL(monthlyEquivalentCents('anual'))}/mês`,
        savings: 'Mesmo PRO, cobrado uma vez por ano',
      },
    },
    description: 'O mesmo produto sem limites, com o histórico inteiro e a leitura da IA.',
    features: [
      'Tudo do gratuito, sem limite de quantidade',
      'Histórico completo, com a evolução do Momentumm Score',
      'Review semanal completo, cruzando os seus dados',
      `Momentumm AI: ${PLAN_LIMITS.pro.aiCallsPerMonth} leituras por mês`,
      'Métricas de período e comparação entre semanas',
      'Círculo ilimitado: convide quantos amigos quiser',
    ],
    cta: 'Assinar o PRO',
    highlight: true,
  },
]

/**
 * O que muda no anual. Não é recurso: é compromisso e preço. Nenhuma linha
 * aqui promete função que o mensal não tenha.
 */
export const ANNUAL_EXTRAS = [
  'Preço protegido na renovação*',
  'Um pagamento por ano, sem cobrança mensal',
] as const

export const PRICING_FOOTNOTE =
  '* O preço protegido vale enquanto a assinatura anual não for cancelada. O valor riscado é quanto custariam doze meses do plano mensal.'
