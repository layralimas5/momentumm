// GERADO por 'npm run billing:bundle' a partir de src/domain/billing/edge-shared.ts. Nao editar.

// src/domain/billing/billing-plans.ts
var BILLING_CYCLES = ["mensal", "anual"];
var PRO_PRICES = {
  mensal: { cycle: "mensal", amountCents: 3990, strikeCents: 7990, providerCycle: "MONTHLY", months: 1 },
  anual: { cycle: "anual", amountCents: 12990, strikeCents: 47880, providerCycle: "YEARLY", months: 12 }
};
var PRO_PRODUCT_NAME = "Momentumm PRO";
function isBillingCycle(value) {
  return typeof value === "string" && BILLING_CYCLES.includes(value);
}
function formatBRL(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = Math.abs(cents % 100);
  return `R$ ${whole.toLocaleString("pt-BR")},${String(fraction).padStart(2, "0")}`;
}
function cycleFromProvider(providerCycle) {
  for (const price of Object.values(PRO_PRICES)) {
    if (price.providerCycle === providerCycle) return price.cycle;
  }
  return null;
}

// src/domain/billing/asaas-events.ts
import { z } from "zod";
var optionalString = z.string().nullish().transform((value) => value ?? null);
var asaasPaymentSchema = z.object({
  id: z.string(),
  customer: z.string(),
  subscription: optionalString,
  externalReference: optionalString,
  checkoutSession: optionalString,
  value: z.number().nonnegative(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.string(),
  billingType: optionalString
});
var asaasSubscriptionSchema = z.object({
  id: z.string(),
  customer: z.string(),
  value: z.number().nonnegative(),
  cycle: z.string(),
  status: z.string(),
  nextDueDate: optionalString,
  externalReference: optionalString,
  checkoutSession: optionalString
});
var asaasCheckoutSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer: optionalString,
  externalReference: optionalString
});
var asaasWebhookEventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payment: asaasPaymentSchema.optional(),
  subscription: asaasSubscriptionSchema.optional(),
  checkout: asaasCheckoutSchema.optional()
});
var PAID_EVENTS = /* @__PURE__ */ new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
var FAILED_EVENTS = /* @__PURE__ */ new Set(["PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_REPROVED_BY_RISK_ANALYSIS"]);
var REFUND_EVENTS = /* @__PURE__ */ new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"]);
var ENDED_EVENTS = /* @__PURE__ */ new Set(["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_EXPIRED"]);
function toCents(value) {
  return Math.round(value * 100);
}
function decideBillingEvent(event) {
  if (event.event === "CHECKOUT_PAID") {
    if (!event.checkout) return { kind: "ignore", reason: "checkout sem corpo" };
    return {
      kind: "checkout_paid",
      checkoutId: event.checkout.id,
      customerId: event.checkout.customer,
      externalReference: event.checkout.externalReference
    };
  }
  if (event.event.startsWith("SUBSCRIPTION_")) {
    if (!ENDED_EVENTS.has(event.event)) return { kind: "ignore", reason: `evento de assinatura sem efeito: ${event.event}` };
    if (!event.subscription) return { kind: "ignore", reason: "assinatura sem corpo" };
    return {
      kind: "subscription_ended",
      providerSubscriptionId: event.subscription.id,
      customerId: event.subscription.customer
    };
  }
  if (!event.event.startsWith("PAYMENT_")) return { kind: "ignore", reason: `evento fora do escopo: ${event.event}` };
  const payment = event.payment;
  if (!payment) return { kind: "ignore", reason: "cobran\xE7a sem corpo" };
  if (!payment.subscription) return { kind: "ignore", reason: "cobran\xE7a sem assinatura" };
  const base = { providerSubscriptionId: payment.subscription, customerId: payment.customer };
  if (PAID_EVENTS.has(event.event)) {
    return {
      kind: "payment_confirmed",
      ...base,
      externalReference: payment.externalReference,
      checkoutSessionId: payment.checkoutSession,
      amountCents: toCents(payment.value),
      dueDate: payment.dueDate
    };
  }
  if (event.event === "PAYMENT_OVERDUE") return { kind: "payment_overdue", ...base };
  if (FAILED_EVENTS.has(event.event)) return { kind: "payment_failed", ...base, code: event.event };
  if (REFUND_EVENTS.has(event.event)) return { kind: "refunded", ...base, amountCents: toCents(payment.value) };
  return { kind: "ignore", reason: `evento de cobran\xE7a sem efeito: ${event.event}` };
}
function periodEndAfter(dueDate, cycle) {
  const [year, month, day] = dueDate.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1 + PRO_PRICES[cycle].months, day, 23, 59, 59));
  return end;
}
function intervalOfProviderSubscription(cycle) {
  return cycleFromProvider(cycle);
}
function transitionFor(current, decision) {
  switch (decision.kind) {
    case "payment_confirmed":
      if (current === null) return { status: "ativa", eventType: "criada" };
      if (current === "ativa" || current === "trial") return { status: "ativa", eventType: "renovada" };
      return { status: "ativa", eventType: "reativada" };
    case "payment_overdue":
      if (current === null || current === "cancelada") return null;
      return { status: "inadimplente", eventType: "vencida" };
    case "payment_failed":
      if (current === null) return null;
      return { status: current, eventType: "pagamento_falhou" };
    case "refunded":
      if (current === null) return null;
      return { status: "cancelada", eventType: "reembolso" };
    case "subscription_ended":
      if (current === null || current === "cancelada") return null;
      return { status: "cancelada", eventType: "cancelada" };
  }
}

// src/domain/billing/cpf.ts
var CPF_LENGTH = 11;
function normalizeCpf(value) {
  return value.replace(/\D/g, "");
}
function isValidCpf(value) {
  const digits = normalizeCpf(value);
  if (digits.length !== CPF_LENGTH) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const numbers = digits.split("").map(Number);
  return checkDigit(numbers, 9) === numbers[9] && checkDigit(numbers, 10) === numbers[10];
}
function checkDigit(numbers, length) {
  const sum = numbers.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
  const remainder = sum * 10 % 11;
  return remainder === 10 ? 0 : remainder;
}
export {
  BILLING_CYCLES,
  PRO_PRICES,
  PRO_PRODUCT_NAME,
  asaasWebhookEventSchema,
  cycleFromProvider,
  decideBillingEvent,
  formatBRL,
  intervalOfProviderSubscription,
  isBillingCycle,
  isValidCpf,
  normalizeCpf,
  periodEndAfter,
  toCents,
  transitionFor
};
