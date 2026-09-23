import { describe, expect, it } from 'vitest'
import {
  asaasWebhookEventSchema,
  decideBillingEvent,
  periodEndAfter,
  toCents,
  transitionFor,
} from './asaas-events'
import { cycleFromProvider, formatBRL, monthlyEquivalentCents, PRO_PRICES } from './billing-plans'

const payment = {
  id: 'pay_1',
  customer: 'cus_1',
  subscription: 'sub_1',
  externalReference: '11111111-1111-4111-8111-111111111111',
  checkoutSession: 'chk_1',
  value: 39.9,
  dueDate: '2026-09-13',
  status: 'CONFIRMED',
  billingType: 'CREDIT_CARD',
}

function event(name: string, body: Record<string, unknown>) {
  return asaasWebhookEventSchema.parse({ id: `evt_${name}`, event: name, ...body })
}

describe('decideBillingEvent', () => {
  it('pagamento confirmado de assinatura vira ativação com valor em centavos', () => {
    const decision = decideBillingEvent(event('PAYMENT_CONFIRMED', { payment }))
    expect(decision).toEqual({
      kind: 'payment_confirmed',
      providerSubscriptionId: 'sub_1',
      customerId: 'cus_1',
      externalReference: payment.externalReference,
      checkoutSessionId: 'chk_1',
      amountCents: 3990,
      dueDate: '2026-09-13',
    })
  })

  it('PAYMENT_RECEIVED é o mesmo que confirmado: o dinheiro só ficou disponível', () => {
    expect(decideBillingEvent(event('PAYMENT_RECEIVED', { payment })).kind).toBe('payment_confirmed')
  })

  it('cobrança sem assinatura não vira PRO', () => {
    const decision = decideBillingEvent(event('PAYMENT_CONFIRMED', { payment: { ...payment, subscription: null } }))
    expect(decision.kind).toBe('ignore')
  })

  it('vencimento, recusa e reembolso têm decisões próprias', () => {
    expect(decideBillingEvent(event('PAYMENT_OVERDUE', { payment })).kind).toBe('payment_overdue')
    expect(decideBillingEvent(event('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', { payment }))).toMatchObject({
      kind: 'payment_failed',
      code: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
    })
    expect(decideBillingEvent(event('PAYMENT_REFUNDED', { payment }))).toMatchObject({
      kind: 'refunded',
      amountCents: 3990,
    })
    expect(decideBillingEvent(event('PAYMENT_CHARGEBACK_REQUESTED', { payment })).kind).toBe('refunded')
  })

  it('eventos informativos são ignorados com o motivo', () => {
    for (const name of ['PAYMENT_CREATED', 'PAYMENT_BANK_SLIP_VIEWED', 'PAYMENT_UPDATED', 'PAYMENT_DELETED']) {
      const decision = decideBillingEvent(event(name, { payment }))
      expect(decision.kind, name).toBe('ignore')
    }
  })

  it('assinatura apagada ou inativada encerra; atualizada não faz nada', () => {
    const subscription = { id: 'sub_1', customer: 'cus_1', value: 39.9, cycle: 'MONTHLY', status: 'INACTIVE' }
    expect(decideBillingEvent(event('SUBSCRIPTION_DELETED', { subscription }))).toEqual({
      kind: 'subscription_ended',
      providerSubscriptionId: 'sub_1',
      customerId: 'cus_1',
    })
    expect(decideBillingEvent(event('SUBSCRIPTION_INACTIVATED', { subscription })).kind).toBe('subscription_ended')
    expect(decideBillingEvent(event('SUBSCRIPTION_UPDATED', { subscription })).kind).toBe('ignore')
  })

  it('checkout pago entrega o cliente do Asaas e a referência externa', () => {
    const decision = decideBillingEvent(
      event('CHECKOUT_PAID', {
        checkout: { id: 'chk_1', status: 'PAID', customer: 'cus_1', externalReference: 'u1' },
      }),
    )
    expect(decision).toEqual({ kind: 'checkout_paid', checkoutId: 'chk_1', customerId: 'cus_1', externalReference: 'u1' })
  })

  it('checkout criado, cancelado ou expirado não muda nada', () => {
    for (const name of ['CHECKOUT_CREATED', 'CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED']) {
      expect(decideBillingEvent(event(name, { checkout: { id: 'chk_1', status: 'ACTIVE' } })).kind, name).toBe('ignore')
    }
  })

  it('recusa evento sem id: sem id não há como evitar processar duas vezes', () => {
    expect(() => asaasWebhookEventSchema.parse({ event: 'PAYMENT_CONFIRMED', payment })).toThrow()
  })
})

describe('transitionFor', () => {
  it('primeiro pagamento cria; o seguinte renova; depois de cancelada, reativa', () => {
    const paid = decideBillingEvent(event('PAYMENT_CONFIRMED', { payment }))
    if (paid.kind !== 'payment_confirmed') throw new Error('decisão inesperada')
    expect(transitionFor(null, paid)).toEqual({ status: 'ativa', eventType: 'criada' })
    expect(transitionFor('ativa', paid)).toEqual({ status: 'ativa', eventType: 'renovada' })
    expect(transitionFor('inadimplente', paid)).toEqual({ status: 'ativa', eventType: 'reativada' })
    expect(transitionFor('cancelada', paid)).toEqual({ status: 'ativa', eventType: 'reativada' })
  })

  it('vencimento derruba pra inadimplente, mas não mexe em assinatura cancelada nem desconhecida', () => {
    const overdue = { kind: 'payment_overdue', providerSubscriptionId: 'sub_1', customerId: 'cus_1' } as const
    expect(transitionFor('ativa', overdue)).toEqual({ status: 'inadimplente', eventType: 'vencida' })
    expect(transitionFor('cancelada', overdue)).toBeNull()
    expect(transitionFor(null, overdue)).toBeNull()
  })

  it('recusa de cartão registra o evento sem mudar o estado', () => {
    const failed = {
      kind: 'payment_failed',
      providerSubscriptionId: 'sub_1',
      customerId: 'cus_1',
      code: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
    } as const
    expect(transitionFor('ativa', failed)).toEqual({ status: 'ativa', eventType: 'pagamento_falhou' })
    expect(transitionFor(null, failed)).toBeNull()
  })

  it('reembolso e encerramento cancelam; encerrar o que já está cancelado é repetição', () => {
    const refunded = { kind: 'refunded', providerSubscriptionId: 'sub_1', customerId: 'cus_1', amountCents: 3990 } as const
    const ended = { kind: 'subscription_ended', providerSubscriptionId: 'sub_1', customerId: 'cus_1' } as const
    expect(transitionFor('ativa', refunded)).toEqual({ status: 'cancelada', eventType: 'reembolso' })
    expect(transitionFor('ativa', ended)).toEqual({ status: 'cancelada', eventType: 'cancelada' })
    expect(transitionFor('cancelada', ended)).toBeNull()
  })
})

describe('período e preços', () => {
  it('o período vale um ciclo a partir do vencimento, não do dia do pagamento', () => {
    expect(periodEndAfter('2026-09-13', 'mensal').toISOString()).toBe('2026-10-13T23:59:59.000Z')
    expect(periodEndAfter('2026-09-13', 'anual').toISOString()).toBe('2027-09-13T23:59:59.000Z')
    expect(periodEndAfter('2026-01-31', 'mensal').toISOString()).toBe('2026-03-03T23:59:59.000Z')
  })

  it('centavos sem erro de ponto flutuante', () => {
    expect(toCents(39.9)).toBe(3990)
    expect(toCents(129.9)).toBe(12990)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })

  it('o ciclo do Asaas volta pro nosso, e ciclo que não vendemos é null', () => {
    expect(cycleFromProvider('MONTHLY')).toBe('mensal')
    expect(cycleFromProvider('YEARLY')).toBe('anual')
    expect(cycleFromProvider('WEEKLY')).toBeNull()
  })

  it('o preço da landing sai do mesmo número do checkout', () => {
    expect(formatBRL(PRO_PRICES.mensal.amountCents)).toBe('R$ 39,90')
    expect(formatBRL(PRO_PRICES.anual.amountCents)).toBe('R$ 129,90')
    expect(formatBRL(PRO_PRICES.anual.strikeCents)).toBe('R$ 478,80')
    expect(formatBRL(monthlyEquivalentCents('anual'))).toBe('R$ 10,83')
    expect(formatBRL(100000)).toBe('R$ 1.000,00')
  })
})
