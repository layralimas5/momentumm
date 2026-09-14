import { describe, expect, it } from 'vitest'
import { formatCpf, isValidCpf, normalizeCpf } from './cpf'

describe('isValidCpf', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(isValidCpf('529.982.247-26')).toBe(false)
  })

  it('recusa sequência repetida mesmo que a conta feche', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
  })

  it('recusa tamanho errado', () => {
    expect(isValidCpf('5299822472')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
})

describe('normalizeCpf e formatCpf', () => {
  it('normaliza tirando tudo que não é dígito', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725')
  })

  it('formata progressivamente enquanto digita', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('5299')).toBe('529.9')
    expect(formatCpf('52998224')).toBe('529.982.24')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(formatCpf('529982247259999')).toBe('529.982.247-25')
  })
})
