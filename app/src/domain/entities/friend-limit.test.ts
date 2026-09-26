import { describe, expect, it } from 'vitest'
import { FREE_FRIENDS, limitsOf, PRO_FRIENDS } from './plan'
import { assertWithinLimit, friendLimit, PlanLimitError } from './plan-usage'

const free = limitsOf('free')
const pro = limitsOf('pro')

describe('o teto do círculo', () => {
  it('no gratuito são duas pessoas', () => {
    expect(free.friends).toBe(FREE_FRIENDS)
    expect(friendLimit(free, 0).reached).toBe(false)
    expect(friendLimit(free, 1).reached).toBe(false)
    expect(friendLimit(free, 2).reached).toBe(true)
  })

  it('no PRO o círculo é maior, mas continua sendo círculo', () => {
    expect(pro.friends).toBe(PRO_FRIENDS)
    expect(friendLimit(pro, 10).reached).toBe(false)
    expect(friendLimit(pro, PRO_FRIENDS).reached).toBe(true)
  })

  it('a mensagem convida pro PRO em vez de acusar', () => {
    const check = friendLimit(free, 2)
    expect(check.message).toContain('Seu círculo está completo')
  })

  it('cheio, a próxima amizade é recusada com o motivo', () => {
    expect(() => assertWithinLimit('circulo', friendLimit(free, 2))).toThrow(PlanLimitError)
    expect(() => assertWithinLimit('circulo', friendLimit(free, 1))).not.toThrow()
  })
})
