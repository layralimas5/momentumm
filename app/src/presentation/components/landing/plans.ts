import {
  formatBRL,
  monthlyEquivalentCents,
  PRO_PRICES,
  type BillingCycle,
} from '@/domain/billing/billing-plans'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { PLAN_LIMITS } from '@/domain/entities/plan'
import { ENCOURAGEMENT_KINDS, PAIR_DAYS } from '@/domain/entities/pair'
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
 * Três cards na ordem gratuito, mensal, anual, com a mesma estrutura: três
 * preços visíveis de uma vez, sem seletor pra descobrir o outro. O PRO é um
 * plano só com dois ciclos de cobrança (o anual não tem recurso a mais), então
 * os dois cards do PRO mostram a mesma lista curta, e a lista inteira
 * (`PRO_ALL_FEATURES`) fica num "ver tudo" embaixo dos cards, em vez de
 * esticar um card só até o dobro dos outros.
 */

export interface Price {
  readonly amount: string
  readonly period: string
  /** O que custaria pagando mês a mês no mesmo período. Só no anual, e é uma conta, não uma promoção. */
  readonly strike?: string
  readonly note?: string
  /** O selo embaixo do preço: a economia do anual, ou o que define o ciclo. */
  readonly tag?: string
  readonly tagTone?: 'positive' | 'neutral'
  /** O que muda no jeito de pagar deste ciclo. Não é recurso: nenhuma linha promete função que o outro ciclo não tenha. */
  readonly perks?: readonly string[]
}

export interface PricingPlan {
  readonly id: string
  readonly badge: string
  readonly headline: string
  readonly price: Price
  /** O ciclo que o botão abre no checkout. Ausente no gratuito, que não tem checkout. */
  readonly checkoutCycle?: BillingCycle
  readonly description: string
  /** Linha que abre a lista, quando o plano soma sobre outro ("Tudo do gratuito, e mais:"). */
  readonly featuresIntro?: string
  readonly features: readonly string[]
  /** O que o plano NÃO tem ou limita. Aparece com marcação neutra, nunca com o check de vantagem. */
  readonly limits?: readonly string[]
  readonly cta: string
  readonly highlight?: boolean
}

const free = PLAN_LIMITS.free
const pro = PRO_PRICES

/** A economia do anual é conta, não promoção: doze meses do mensal menos o anual. */
const ANNUAL_SAVINGS = formatBRL(pro.anual.strikeCents - pro.anual.amountCents)

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const FREE_PRICE: Price = {
  amount: 'R$ 0',
  period: 'para sempre',
  note: 'Sem cartão e sem prazo pra decidir',
  tag: 'Grátis pra sempre',
  tagTone: 'neutral',
  perks: TRIAL_PROMISE_VERIFIED
    ? ['O ciclo inteiro: plano, dia, Score e Juntos', `Começa com ${TRIAL_DAYS} dias de PRO`]
    : ['O ciclo inteiro: plano, dia, Score e Juntos', 'Seus dados continuam se um dia assinar'],
}

const FREE_DESCRIPTION = 'Organize metas e hábitos e faça o passo do dia, sem pagar nada.'

/** O que o PRO tem, inteiro. Aparece no "ver tudo" embaixo dos cards. */
export const PRO_ALL_FEATURES: readonly string[] = [
  'Objetivos, hábitos e planos ativos sem limite',
  'Ações por dia sem limite',
  'Histórico completo, desde o primeiro dia',
  'Momentumm Score com evolução e detalhamento',
  'Review semanal completo, cruzando os seus dados',
  'Métricas dos últimos 7 dias e do mês inteiro',
  'Onde você avançou e o que pede atenção, com o ajuste pronto pra aplicar',
  `Momentumm AI: ${PLAN_LIMITS.pro.aiCallsPerMonth} leituras por mês`,
  'A IA transforma um objetivo em plano por etapas que cabe no seu tempo',
  'A IA lê o seu progresso e sugere o próximo ajuste',
  'Aviso quando uma etapa trava, a constância cai ou o dia passa da sua capacidade',
  'Juntos: duplas ilimitadas',
  `Juntos: a semana inteira da dupla (${PAIR_DAYS} dias)`,
  `Juntos: os ${ENCOURAGEMENT_KINDS.length} incentivos, todo dia`,
  'Notas nos registros de atividade',
  'Todos os modelos de card pra compartilhar, com personalização',
  'Atendimento prioritário no suporte',
]

/** O resumo que os dois cards do PRO mostram: o que mais pesa na decisão. */
const PRO_HIGHLIGHTS: readonly string[] = [
  'Objetivos, hábitos e planos sem limite',
  'Ações por dia sem limite',
  'Histórico completo, desde o primeiro dia',
  'Review semanal completo e métricas do mês',
  `Momentumm AI: ${PLAN_LIMITS.pro.aiCallsPerMonth} leituras por mês`,
  'Juntos: duplas ilimitadas',
]

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    badge: 'FREE',
    headline: 'Organize e execute',
    price: FREE_PRICE,
    description: FREE_DESCRIPTION,
    features: [
      'Objetivos com plano por etapas e ações',
      'Hábitos com versão mínima e sequência',
      'A tela Hoje, com Dia Adaptável e Modo Retomada',
      'Momentumm Score de hoje',
      `Juntos: ${plural(free.pairs, 'dupla', 'duplas')}`,
    ],
    limits: [
      `Até ${plural(free.activeObjectives, 'objetivo', 'objetivos')}, ${plural(free.activeHabits, 'hábito', 'hábitos')} e ${plural(free.activePlans, 'plano', 'planos')} ativos`,
      `Até ${free.actionsPerDay} ações por dia`,
      `Histórico dos últimos ${free.historyDays} dias`,
      'Sem Momentumm AI, review completo e métricas',
    ],
    cta: 'Criar meu plano',
  },
  {
    id: 'pro-mensal',
    badge: 'PRO mensal',
    headline: 'Sem limites, mês a mês',
    price: {
      amount: formatBRL(pro.mensal.amountCents),
      period: '/mês',
      note: `${formatBRL(pro.mensal.amountCents * 12)} em 12 meses`,
      tag: 'Sem fidelidade',
      tagTone: 'neutral',
      perks: ['Cancela quando quiser, em Configurações', 'Os mesmos recursos do PRO anual'],
    },
    checkoutCycle: 'mensal',
    description: 'O PRO inteiro, pago mês a mês. Bom pra sentir o ritmo antes de fechar o ano.',
    featuresIntro: 'Tudo do gratuito, e mais:',
    features: PRO_HIGHLIGHTS,
    cta: 'Assinar o PRO mensal',
  },
  {
    id: 'pro-anual',
    badge: 'PRO anual',
    headline: 'Sem limites, pelo menor preço',
    price: {
      amount: formatBRL(pro.anual.amountCents),
      period: '/ano',
      strike: formatBRL(pro.anual.strikeCents),
      note: `equivale a ${formatBRL(monthlyEquivalentCents('anual'))}/mês`,
      tag: `Economia de ${ANNUAL_SAVINGS} por ano`,
      tagTone: 'positive',
      perks: ['Um pagamento só, sem cobrança todo mês', 'Preço protegido na renovação*'],
    },
    checkoutCycle: 'anual',
    description: 'O mesmo PRO num pagamento só, com o histórico inteiro e a leitura da IA.',
    featuresIntro: 'Tudo do gratuito, e mais:',
    features: PRO_HIGHLIGHTS,
    cta: 'Assinar o PRO anual',
    highlight: true,
  },
]

export const PRICING_FOOTNOTE =
  '* O preço protegido vale enquanto a assinatura anual não for cancelada. O valor riscado e a economia são a conta de doze meses do plano mensal.'
