import { describe, expect, it } from 'vitest'
import type { Subscription } from './subscription'
import { isTrialActive, planAccessOf, trialDaysLeft, type PlanTrial } from './trial'

const NOW = new Date('2026-09-17T12:00:00Z')

function trial(overrides: Partial<PlanTrial> = {}): PlanTrial {
  return {
    startedAt: new Date('2026-09-15T00:00:00Z'),
    endsAt: new Date('2026-09-22T00:00:00Z'),
    status: 'ativo',
    ...overrides,
  }
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 's1',
    provider: 'asaas',
    interval: 'mensal',
    status: 'ativa',
    amountCents: 3990,
    startedAt: NOW,
    currentPeriodEnd: new Date('2026-10-17T00:00:00Z'),
    canceledAt: null,
    ...overrides,
  }
}

describe('isTrialActive', () => {
  it('vale enquanto o prazo não passou', () => {
    expect(isTrialActive(trial(), NOW)).toBe(true)
  })

  it('cai no fim do prazo, mesmo com o status ainda ativo', () => {
    expect(isTrialActive(trial({ endsAt: NOW }), NOW)).toBe(false)
  })

  it('encerrado ou convertido nunca vale', () => {
    expect(isTrialActive(trial({ status: 'encerrado' }), NOW)).toBe(false)
    expect(isTrialActive(trial({ status: 'convertido' }), NOW)).toBe(false)
    expect(isTrialActive(null, NOW)).toBe(false)
  })
})

describe('trialDaysLeft', () => {
  it('arredonda pra cima: o dia de hoje conta', () => {
    expect(trialDaysLeft(trial(), NOW)).toBe(5)
  })

  it('zero depois do fim', () => {
    expect(trialDaysLeft(trial({ endsAt: new Date('2026-09-16T00:00:00Z') }), NOW)).toBe(0)
  })
})

describe('planAccessOf', () => {
  it('assinatura valendo é PRO pago, com ou sem teste', () => {
    expect(planAccessOf('pro', subscription(), trial(), null, NOW)).toBe('paid')
  })

  it('assinatura cancelada dentro do período ainda é pago', () => {
    expect(planAccessOf('pro', subscription({ status: 'cancelada' }), null, null, NOW)).toBe('paid')
  })

  it('PRO sem assinatura e com teste ativo é teste', () => {
    expect(planAccessOf('pro', null, trial(), null, NOW)).toBe('trial')
  })

  it('PRO sem assinatura nem teste ativo é cortesia da equipe', () => {
    expect(planAccessOf('pro', null, trial({ status: 'encerrado' }), null, NOW)).toBe('courtesy')
    expect(planAccessOf('pro', null, null, null, NOW)).toBe('courtesy')
  })

  /*
    O caso da dona do produto: teste ativo E cortesia infinita na mesma conta.

    Antes disso o app anunciava o fim de um teste que não muda nada pra ela.
  */
  it('cortesia que passa do teste ganha dele', () => {
    const infinita = new Date(8_640_000_000_000_000)
    expect(planAccessOf('pro', null, trial(), infinita, NOW)).toBe('courtesy')
  })

  it('cortesia que termina antes do teste não rouba a vez dele', () => {
    const curta = new Date('2026-09-18T00:00:00Z')
    expect(planAccessOf('pro', null, trial(), curta, NOW)).toBe('trial')
  })

  it('cortesia vencida não conta', () => {
    const vencida = new Date('2026-09-01T00:00:00Z')
    expect(planAccessOf('pro', null, trial({ status: 'encerrado' }), vencida, NOW)).toBe('courtesy')
    expect(planAccessOf('pro', null, trial(), vencida, NOW)).toBe('trial')
  })

  it('assinatura paga ganha até da cortesia infinita', () => {
    const infinita = new Date(8_640_000_000_000_000)
    expect(planAccessOf('pro', subscription(), trial(), infinita, NOW)).toBe('paid')
  })

  it('gratuito é gratuito, mesmo com teste vencido na conta', () => {
    expect(planAccessOf('free', null, trial({ endsAt: NOW }), null, NOW)).toBe('free')
    expect(planAccessOf('free', subscription({ status: 'vencida' }), null, null, NOW)).toBe('free')
  })
})
