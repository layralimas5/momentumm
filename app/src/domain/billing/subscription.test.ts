import { describe, expect, it } from 'vitest'
import { subscriptionBilling, type Subscription } from './subscription'

const fim = new Date('2026-10-30T23:59:59Z')

function sub(patch: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    provider: 'asaas',
    interval: 'mensal',
    status: 'ativa',
    amountCents: 2490,
    renewalAmountCents: 2490,
    offer: null,
    startedAt: new Date('2026-09-30'),
    currentPeriodEnd: fim,
    canceledAt: null,
    ...patch,
  }
}

describe('subscriptionBilling', () => {
  it('primeiro mês com oferta: paga R$ 9,90 agora e a próxima é R$ 24,90', () => {
    expect(subscriptionBilling(sub({ amountCents: 990, offer: 'primeiro_mes' }))).toEqual({
      currentCents: 990,
      inOffer: true,
      nextCharge: { amountCents: 2490, at: fim },
    })
  })

  it('depois da oferta, a mesma assinatura já está no preço cheio', () => {
    expect(subscriptionBilling(sub({ offer: 'primeiro_mes' })).inOffer).toBe(false)
  })

  it('Fundadores no primeiro ano renova pelo anual vigente', () => {
    const billing = subscriptionBilling(sub({ interval: 'anual', amountCents: 6990, renewalAmountCents: 9990, offer: 'fundadores' }))
    expect(billing.inOffer).toBe(true)
    expect(billing.nextCharge?.amountCents).toBe(9990)
  })

  it('assinatura antiga, sem valor de renovação gravado, renova pelo que pagou', () => {
    expect(subscriptionBilling(sub({ amountCents: 3990, renewalAmountCents: null })).nextCharge?.amountCents).toBe(3990)
  })

  it('cancelada não tem próxima cobrança', () => {
    expect(subscriptionBilling(sub({ status: 'cancelada', canceledAt: new Date() })).nextCharge).toBeNull()
  })
})
