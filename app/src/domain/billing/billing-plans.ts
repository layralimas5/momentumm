/**
 * O preço do PRO, num lugar só.
 *
 * A landing, a tela de assinatura e a Edge Function que abre o checkout
 * leem daqui. Preço copiado em três lugares é como a landing promete
 * R$ 39,90 no dia em que o checkout cobra R$ 49,90.
 *
 * Este arquivo não importa nada de propósito: ele é empacotado pro Deno
 * (`npm run billing:bundle`) e precisa continuar simples de carregar lá.
 */

export const BILLING_CYCLES = ['mensal', 'anual'] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]

export interface ProPrice {
  readonly cycle: BillingCycle
  /** Em centavos, porque dinheiro em ponto flutuante é como 39,90 vira 39,899999. */
  readonly amountCents: number
  /** O preço "de tabela" riscado na landing. Só comunicação, o checkout não o vê. */
  readonly strikeCents: number
  /** O ciclo no vocabulário do Asaas. */
  readonly providerCycle: 'MONTHLY' | 'YEARLY'
  /** Quantos meses o ciclo cobre: é o que decide até quando o PRO vale depois de um pagamento. */
  readonly months: number
}

export const PRO_PRICES: Readonly<Record<BillingCycle, ProPrice>> = {
  mensal: { cycle: 'mensal', amountCents: 3990, strikeCents: 7990, providerCycle: 'MONTHLY', months: 1 },
  anual: { cycle: 'anual', amountCents: 17990, strikeCents: 35880, providerCycle: 'YEARLY', months: 12 },
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

/** Quanto por mês custa o anual, pra frase "equivale a R$ 14,99/mês". */
export function monthlyEquivalentCents(cycle: BillingCycle): number {
  const price = PRO_PRICES[cycle]
  return Math.round(price.amountCents / price.months)
}
