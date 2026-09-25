import { describe, expect, it } from 'vitest'
import { PLAN_LIMITS } from '@/domain/entities/plan'
import {
  isProSupportCategory,
  PRO_SUPPORT_CATEGORIES,
  RIGHT_SUPPORT_CATEGORIES,
  SUPPORT_CATEGORIES,
  supportCategoriesFor,
} from './support-request'

/**
 * Que parte do suporte é benefício de plano, e que parte é direito.
 *
 * A linha aqui não é de produto, é legal: exclusão de conta, exportação e
 * privacidade são obrigação, e uma delas atrás do PRO seria cobrar assinatura
 * pra alguém exercer um direito. Segurança, pagamento, acesso e denúncia ficam
 * do mesmo lado por consequência — quem não consegue entrar ou foi cobrado
 * errado não pode ser obrigado a assinar pra reclamar disso.
 *
 * Por isso o teste trava as duas pontas: que o PRO abre tudo, e que o gratuito
 * NUNCA perde nenhuma das sete. Uma categoria nova que entrar sem ser
 * classificada cai como PRO e este teste acusa.
 */

const FREE = PLAN_LIMITS.free
const PRO = PLAN_LIMITS.pro

describe('suporte por plano', () => {
  it('toda categoria está de um lado ou do outro, sem sobra', () => {
    const classificadas = [...RIGHT_SUPPORT_CATEGORIES, ...PRO_SUPPORT_CATEGORIES].sort()
    expect(classificadas).toEqual([...SUPPORT_CATEGORIES].sort())
  })

  it('só "ajuda com o app" é do PRO', () => {
    expect(PRO_SUPPORT_CATEGORIES).toEqual(['suporte'])
  })

  it('o gratuito não tem ajuda com o app', () => {
    expect(FREE.appSupport).toBe(false)
    expect(supportCategoriesFor(FREE.appSupport)).not.toContain('suporte')
  })

  it('o gratuito mantém as sete categorias que são direito', () => {
    const disponiveis = supportCategoriesFor(FREE.appSupport)
    for (const categoria of RIGHT_SUPPORT_CATEGORIES) {
      expect(disponiveis).toContain(categoria)
    }
  })

  /*
    O caso que não pode quebrar em silêncio: sem exclusão e exportação, o
    gratuito perde o caminho de apagar a própria conta e de levar os dados
    embora — e isso não é decisão de produto.
  */
  it('exclusão, exportação e privacidade valem em qualquer plano', () => {
    for (const tier of [FREE, PRO]) {
      const disponiveis = supportCategoriesFor(tier.appSupport)
      expect(disponiveis).toContain('exclusao')
      expect(disponiveis).toContain('exportacao')
      expect(disponiveis).toContain('privacidade')
      expect(disponiveis).toContain('seguranca')
    }
  })

  it('o PRO abre todas', () => {
    expect(PRO.appSupport).toBe(true)
    expect(supportCategoriesFor(PRO.appSupport)).toEqual(SUPPORT_CATEGORIES)
  })

  it('a lista do gratuito nunca vem vazia: o formulário precisa de um valor inicial', () => {
    expect(supportCategoriesFor(false).length).toBeGreaterThan(0)
  })

  it('isProSupportCategory concorda com as listas', () => {
    expect(isProSupportCategory('suporte')).toBe(true)
    expect(isProSupportCategory('exclusao')).toBe(false)
  })
})
