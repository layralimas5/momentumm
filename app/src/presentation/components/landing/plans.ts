import {
  cyclePeriod,
  formatBRL,
  monthlyEquivalentCents,
  type BillingCycle,
  type ProQuote,
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
  /** O preço de tabela riscado ao lado do valor. Só na campanha Fundadores. */
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

/**
 * O preço sempre diz a renovação, na mesma frase. Oferta que esconde quanto
 * vem depois é o jeito mais rápido de o primeiro mês barato virar pedido de
 * reembolso no segundo.
 */
function renewalNote(quote: ProQuote): string {
  return `Depois, ${formatBRL(quote.renewalCents)}/${cyclePeriod(quote.cycle)}.`
}

function monthlyPrice(quote: ProQuote): Price {
  const intro = quote.offer === 'primeiro_mes'
  return {
    amount: formatBRL(quote.firstCents),
    period: intro ? 'no primeiro mês' : '/mês',
    ...(intro ? { note: renewalNote(quote) } : {}),
    tag: 'Sem fidelidade',
    tagTone: 'neutral',
    perks: ['Cancela quando quiser, em Configurações', 'Os mesmos recursos do PRO anual'],
  }
}

function annualPrice(quote: ProQuote): Price {
  if (quote.offer === 'fundadores') {
    return {
      amount: formatBRL(quote.firstCents),
      period: 'no primeiro ano',
      strike: formatBRL(quote.renewalCents),
      note: renewalNote(quote),
      tag: 'Oferta Fundadores',
      tagTone: 'positive',
      perks: ['Condição especial dos primeiros usuários do Momentumm', 'Um pagamento só, sem cobrança todo mês'],
    }
  }
  return {
    amount: formatBRL(quote.firstCents),
    period: '/ano',
    note: `equivale a ${formatBRL(monthlyEquivalentCents('anual', quote.firstCents))}/mês`,
    tag: 'Mais econômico',
    tagTone: 'positive',
    perks: ['Um pagamento só, sem cobrança todo mês', 'Preço protegido na renovação*'],
  }
}

export function pricingPlans(quotes: Readonly<Record<BillingCycle, ProQuote>>): readonly PricingPlan[] {
  return [
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
      headline: 'Pra começar a avançar',
      price: monthlyPrice(quotes.mensal),
      checkoutCycle: 'mensal',
      description: 'O PRO inteiro, mês a mês. Bom pra sentir o ritmo antes de fechar o ano.',
      featuresIntro: 'Tudo do gratuito, e mais:',
      features: PRO_HIGHLIGHTS,
      cta: 'Começar com PRO',
    },
    {
      id: 'pro-anual',
      badge: 'PRO anual',
      headline: 'Um ano inteiro de constância',
      price: annualPrice(quotes.anual),
      checkoutCycle: 'anual',
      description: 'O mesmo PRO num pagamento só, pelo menor preço por mês.',
      featuresIntro: 'Tudo do gratuito, e mais:',
      features: PRO_HIGHLIGHTS,
      cta: 'Escolher anual',
      highlight: true,
    },
  ]
}

export function pricingFootnote(quotes: Readonly<Record<BillingCycle, ProQuote>>): string {
  if (quotes.anual.offer === 'fundadores') {
    return `A Oferta Fundadores vale no primeiro ano. Depois, a assinatura renova pelo preço anual vigente, hoje ${formatBRL(quotes.anual.renewalCents)}.`
  }
  return '* O preço protegido vale enquanto a assinatura anual não for cancelada.'
}
