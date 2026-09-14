/**
 * O que as Edge Functions `asaas-billing` e `asaas-webhook` importam do
 * domínio. Mesmo molde de `domain/ai/edge-shared`: o esbuild empacota este
 * arquivo em `supabase/functions/_shared/billing.ts` (`npm run
 * billing:bundle`), e a regra de preço e de evento continua num lugar só.
 */
export {
  BILLING_CYCLES,
  cycleFromProvider,
  formatBRL,
  isBillingCycle,
  PRO_PRICES,
  PRO_PRODUCT_NAME,
  type BillingCycle,
} from './billing-plans'
export {
  asaasWebhookEventSchema,
  decideBillingEvent,
  intervalOfProviderSubscription,
  periodEndAfter,
  toCents,
  transitionFor,
  type AsaasWebhookEvent,
  type BillingDecision,
} from './asaas-events'
export { isValidCpf, normalizeCpf } from './cpf'
export type { BillingErrorCode } from './billing-error'
export type { SubscriptionStatus } from './subscription'
