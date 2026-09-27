import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  EMPTY_SOCIAL_LINKS,
  filledSocials,
  normalizeSocialHandle,
  socialDisplay,
  socialUrl,
} from './social-link'

describe('normalizeSocialHandle', () => {
  it('aceita o @ com e sem arroba', () => {
    expect(normalizeSocialHandle('@layra.lima')).toBe('layra.lima')
    expect(normalizeSocialHandle('layra.lima')).toBe('layra.lima')
    expect(normalizeSocialHandle('  @layra.lima  ')).toBe('layra.lima')
  })

  it('tira a URL inteira colada do navegador, com rastreador e tudo', () => {
    expect(normalizeSocialHandle('https://instagram.com/layra.lima?igsh=abc123')).toBe('layra.lima')
    expect(normalizeSocialHandle('www.tiktok.com/@layra.lima')).toBe('layra.lima')
    expect(normalizeSocialHandle('https://www.linkedin.com/in/layra-lima/')).toBe('layra-lima')
  })

  it('campo vazio é ausência de rede, não erro', () => {
    expect(normalizeSocialHandle('')).toBeNull()
    expect(normalizeSocialHandle('   ')).toBeNull()
    expect(normalizeSocialHandle('@')).toBeNull()
  })

  it('recusa o que nenhuma das três aceitaria', () => {
    expect(() => normalizeSocialHandle('layra lima')).toThrow(DomainError)
    expect(() => normalizeSocialHandle('layra/lima')).toThrow(DomainError)
    expect(() => normalizeSocialHandle('l'.repeat(41))).toThrow(DomainError)
  })
})

describe('exibição', () => {
  it('usa o sinal de cada rede', () => {
    expect(socialDisplay('instagram', 'lay')).toBe('@lay')
    expect(socialDisplay('tiktok', 'lay')).toBe('@lay')
    // O LinkedIn não tem @: escrever um seria inventar um endereço.
    expect(socialDisplay('linkedin', 'lay')).toBe('/lay')
  })

  it('monta o endereço na hora de abrir', () => {
    expect(socialUrl('instagram', 'lay')).toBe('https://instagram.com/lay')
    expect(socialUrl('tiktok', 'lay')).toBe('https://tiktok.com/@lay')
    expect(socialUrl('linkedin', 'lay')).toBe('https://linkedin.com/in/lay')
  })

  it('rede vazia não vira chip vazio', () => {
    expect(filledSocials(EMPTY_SOCIAL_LINKS)).toEqual([])
    expect(filledSocials({ ...EMPTY_SOCIAL_LINKS, tiktok: 'lay' })).toEqual([
      { network: 'tiktok', handle: 'lay' },
    ])
  })
})
