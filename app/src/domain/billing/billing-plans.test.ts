import { describe, expect, it } from 'vitest'
import { monthlyEquivalentCents, offerOfCharge, PRO_OFFER_TERMS, PRO_PRICES, quotePro, quoteSentence } from './billing-plans'

const novo = { firstSubscription: true, foundersActive: false }
const veterano = { firstSubscription: false, foundersActive: true }

describe('quotePro', () => {
  it('mensal de quem nunca assinou: R$ 9,90 e depois R$ 24,90', () => {
    expect(quotePro('mensal', novo)).toEqual({ cycle: 'mensal', offer: 'primeiro_mes', firstCents: 990, renewalCents: 2490 })
  })

  it('mensal de quem já assinou paga o preço de tabela desde a primeira cobrança', () => {
    expect(quotePro('mensal', veterano)).toEqual({ cycle: 'mensal', offer: null, firstCents: 2490, renewalCents: 2490 })
  })

  it('anual sem campanha: R$ 99,90', () => {
    expect(quotePro('anual', novo)).toEqual({ cycle: 'anual', offer: null, firstCents: 9990, renewalCents: 9990 })
  })

  it('anual com Fundadores ligado, pra quem nunca assinou: R$ 69,90 no primeiro ano', () => {
    expect(quotePro('anual', { firstSubscription: true, foundersActive: true })).toEqual({
      cycle: 'anual',
      offer: 'fundadores',
      firstCents: 6990,
      renewalCents: 9990,
    })
  })

  it('Fundadores não vale pra quem já assinou', () => {
    expect(quotePro('anual', veterano).offer).toBeNull()
  })
})

describe('offerOfCharge', () => {
  it('reconhece a oferta pelo valor pago no ciclo certo', () => {
    expect(offerOfCharge('mensal', 990)).toBe('primeiro_mes')
    expect(offerOfCharge('anual', 6990)).toBe('fundadores')
  })

  it('preço cheio, ou valor de oferta no ciclo errado, não é oferta', () => {
    expect(offerOfCharge('mensal', 2490)).toBeNull()
    expect(offerOfCharge('anual', 990)).toBeNull()
    expect(offerOfCharge('mensal', 3990)).toBeNull()
  })

  it('valor de oferta nunca coincide com preço de tabela', () => {
    const tabela = Object.values(PRO_PRICES).map((price) => price.amountCents)
    for (const terms of Object.values(PRO_OFFER_TERMS)) expect(tabela).not.toContain(terms.firstCents)
  })
})

it('o anual equivale a R$ 8,33 por mês', () => {
  expect(monthlyEquivalentCents('anual')).toBe(833)
})

describe('quoteSentence', () => {
  it('diz a renovação junto com a oferta', () => {
    expect(quoteSentence(quotePro('mensal', novo))).toBe('R$ 9,90 no primeiro mês, depois R$ 24,90 por mês.')
    expect(quoteSentence(quotePro('anual', { firstSubscription: true, foundersActive: true }))).toBe(
      'R$ 69,90 no primeiro ano, depois R$ 99,90 por ano.',
    )
  })

  it('sem oferta, só o preço', () => {
    expect(quoteSentence(quotePro('anual', novo))).toBe('R$ 99,90 por ano.')
  })
})
