import { describe, expect, it } from 'vitest'
import { inviteCodeOf, inviteMessage, inviteUrl, parseInviteCode } from './referral'

describe('o código do convite', () => {
  it('é o @ em minúsculas', () => {
    expect(inviteCodeOf('LayraLima')).toBe('layralima')
    expect(inviteCodeOf('  lay  ')).toBe('lay')
  })

  it('monta o link com a origem de quem está rodando', () => {
    expect(inviteUrl('https://momentumm.app', 'lay')).toBe('https://momentumm.app/convite/lay')
  })

  it('a mensagem leva o nome e o link', () => {
    const texto = inviteMessage('Lay', 'https://momentumm.app/convite/lay')
    expect(texto).toContain('Lay')
    expect(texto).toContain('https://momentumm.app/convite/lay')
  })
})

describe('parseInviteCode', () => {
  it('aceita o @ com ou sem arroba, em qualquer caixa', () => {
    expect(parseInviteCode('lay')).toBe('lay')
    expect(parseInviteCode('@Lay')).toBe('lay')
    expect(parseInviteCode('LAY')).toBe('lay')
  })

  it('link torto vira ausência de convite, nunca erro', () => {
    expect(parseInviteCode(null)).toBeNull()
    expect(parseInviteCode('')).toBeNull()
    // Curto demais pra ser um @ válido depois da limpeza.
    expect(parseInviteCode('@@')).toBeNull()
    expect(parseInviteCode('a!')).toBeNull()
  })

  it('limpa acento e caractere estranho antes de julgar', () => {
    expect(parseInviteCode('láyra')).toBe('layra')
  })
})
