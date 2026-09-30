/**
 * O preço do PRO, num lugar só.
 *
 * A landing, a tela de assinatura e a Edge Function que abre o checkout
 * leem daqui. Preço copiado em três lugares é como a landing promete
 * R$ 24,90 no dia em que o checkout cobra R$ 39,90.
 *
 * Este arquivo não importa nada de propósito: ele é empacotado pro Deno
 * (`npm run billing:bundle`) e precisa continuar simples de carregar lá.
 */

export const BILLING_CYCLES = ['mensal', 'anual'] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]

export interface ProPrice {
  readonly cycle: BillingCycle
  /**
   * O preço de TABELA, o que a renovação cobra. Em centavos, porque dinheiro
   * em ponto flutuante é como 24,90 vira 24,899999.
   */
  readonly amountCents: number
  /** Quanto custaria o mesmo período no mensal. Só comunicação, o checkout não o vê. */
  readonly strikeCents: number
  /** O ciclo no vocabulário do Asaas. */
  readonly providerCycle: 'MONTHLY' | 'YEARLY'
  /** Quantos meses o ciclo cobre: é o que decide até quando o PRO vale depois de um pagamento. */
  readonly months: number
}

export const PRO_PRICES: Readonly<Record<BillingCycle, ProPrice>> = {
  mensal: { cycle: 'mensal', amountCents: 2490, strikeCents: 2490, providerCycle: 'MONTHLY', months: 1 },
  anual: { cycle: 'anual', amountCents: 9990, strikeCents: 29880, providerCycle: 'YEARLY', months: 12 },
}

/**
 * As condições de entrada. Cada uma mexe só na PRIMEIRA cobrança de um ciclo;
 * da segunda em diante vale o preço de tabela, e isso é dito antes de pagar.
 *
 *   primeiro_mes  o mensal de quem nunca assinou: R$ 9,90 no primeiro mês.
 *   fundadores    o anual de quem nunca assinou, só com a campanha ligada
 *                 (`features.foundersOffer`): R$ 69,90 no primeiro ano.
 *
 * O webhook reconhece a oferta pelo VALOR da cobrança paga e, depois dela,
 * sobe a assinatura no Asaas pro preço de tabela. Por isso os valores de
 * oferta nunca podem coincidir com um preço de tabela.
 */
export const PRO_OFFERS = ['primeiro_mes', 'fundadores'] as const
export type ProOffer = (typeof PRO_OFFERS)[number]

export interface ProOfferTerms {
  readonly offer: ProOffer
  readonly cycle: BillingCycle
  readonly firstCents: number
}

export const PRO_OFFER_TERMS: Readonly<Record<ProOffer, ProOfferTerms>> = {
  primeiro_mes: { offer: 'primeiro_mes', cycle: 'mensal', firstCents: 990 },
  fundadores: { offer: 'fundadores', cycle: 'anual', firstCents: 6990 },
}

/** O que a pessoa paga agora e o que paga depois, num ciclo. */
export interface ProQuote {
  readonly cycle: BillingCycle
  readonly offer: ProOffer | null
  readonly firstCents: number
  readonly renewalCents: number
}

export interface QuoteContext {
  /** Nunca pagou uma assinatura PRO. O teste grátis de 7 dias não conta. */
  readonly firstSubscription: boolean
  /** A campanha Fundadores está ligada no painel. */
  readonly foundersActive: boolean
}

export function quotePro(cycle: BillingCycle, context: QuoteContext): ProQuote {
  const renewalCents = PRO_PRICES[cycle].amountCents
  const offer = offerFor(cycle, context)
  return {
    cycle,
    offer,
    firstCents: offer ? PRO_OFFER_TERMS[offer].firstCents : renewalCents,
    renewalCents,
  }
}

function offerFor(cycle: BillingCycle, context: QuoteContext): ProOffer | null {
  if (!context.firstSubscription) return null
  if (cycle === 'mensal') return 'primeiro_mes'
  return context.foundersActive ? 'fundadores' : null
}

/** A oferta que produziu uma cobrança desse valor nesse ciclo, ou `null` se foi preço cheio. */
export function offerOfCharge(cycle: BillingCycle, amountCents: number): ProOffer | null {
  for (const terms of Object.values(PRO_OFFER_TERMS)) {
    if (terms.cycle === cycle && terms.firstCents === amountCents) return terms.offer
  }
  return null
}

export function isProOffer(value: unknown): value is ProOffer {
  return typeof value === 'string' && (PRO_OFFERS as readonly string[]).includes(value)
}

/** O nome do item como aparece na fatura. O Asaas aceita até 30 caracteres. */
export const PRO_PRODUCT_NAME = 'Momentumm PRO'

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && (BILLING_CYCLES as readonly string[]).includes(value)
}

export function formatBRL(cents: number): string {
  const whole = Math.floor(cents / 100)
  const fraction = Math.abs(cents % 100)
  return `R$ ${whole.toLocaleString('pt-BR')},${String(fraction).padStart(2, '0')}`
}

/** O ciclo do Asaas de volta pro nosso. `null` pra ciclo que o produto não vende. */
export function cycleFromProvider(providerCycle: string): BillingCycle | null {
  for (const price of Object.values(PRO_PRICES)) {
    if (price.providerCycle === providerCycle) return price.cycle
  }
  return null
}

/** Quanto por mês custa o ciclo, pra frase "equivale a R$ 8,33/mês". */
export function monthlyEquivalentCents(cycle: BillingCycle, amountCents = PRO_PRICES[cycle].amountCents): number {
  return Math.round(amountCents / PRO_PRICES[cycle].months)
}

/** "por mês" ou "por ano", do jeito que a frase de preço usa. */
export function cyclePeriod(cycle: BillingCycle): string {
  return cycle === 'anual' ? 'ano' : 'mês'
}
