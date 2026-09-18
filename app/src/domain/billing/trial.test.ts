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
    expect(planAccessOf('pro', subscription(), trial(), NOW)).toBe('paid')
  })

  it('assinatura cancelada dentro do período ainda é pago', () => {
    expect(planAccessOf('pro', subscription({ status: 'cancelada' }), null, NOW)).toBe('paid')
  })

  it('PRO sem assinatura e com teste ativo é teste', () => {
    expect(planAccessOf('pro', null, trial(), NOW)).toBe('trial')
  })

  it('PRO sem assinatura nem teste ativo é cortesia da equipe', () => {
    expect(planAccessOf('pro', null, trial({ status: 'encerrado' }), NOW)).toBe('courtesy')
    expect(planAccessOf('pro', null, null, NOW)).toBe('courtesy')
  })

  it('gratuito é gratuito, mesmo com teste vencido na conta', () => {
    expect(planAccessOf('free', null, trial({ endsAt: NOW }), NOW)).toBe('free')
    expect(planAccessOf('free', subscription({ status: 'vencida' }), null, NOW)).toBe('free')
  })
})
