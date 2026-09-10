import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  assertStrongPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordStrength,
} from './password'

describe('assertStrongPassword', () => {
  it('aceita uma frase que a pessoa consegue lembrar', () => {
    expect(() => assertStrongPassword('café com pão de manhã')).not.toThrow()
  })

  it('recusa senha curta, por mais bagunçada que seja', () => {
    // `Xk9$mQ2!` tem quatro classes de caractere e cai em segundos offline.
    expect(() => assertStrongPassword('Xk9$mQ2!')).toThrow(DomainError)
  })

  it('exige o mínimo de caracteres', () => {
    expect(() => assertStrongPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toThrow(DomainError)
  })

  it('recusa acima do que o bcrypt enxerga', () => {
    // Além de 72 bytes o hash ignora o resto: aceitar seria prometer uma
    // proteção que não existe.
    expect(() => assertStrongPassword('a1B$'.repeat(30))).toThrow(DomainError)
    expect('a1B$'.repeat(30).length).toBeGreaterThan(MAX_PASSWORD_LENGTH)
  })

  it('recusa um caractere repetido do começo ao fim', () => {
    expect(() => assertStrongPassword('aaaaaaaaaaaaaaaa')).toThrow(DomainError)
  })

  it('recusa as senhas mais tentadas em ataque', () => {
    expect(() => assertStrongPassword('senha123456')).toThrow(DomainError)
    expect(() => assertStrongPassword('MOMENTUMM123')).toThrow(DomainError)
  })

  it('a mensagem ensina o que fazer, sem falar de hash nem de política', () => {
    try {
      assertStrongPassword('curta')
      expect.unreachable('deveria ter recusado')
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError)
      expect((error as DomainError).message).toContain('frase')
    }
  })
})

describe('passwordStrength', () => {
  it('classifica sem decidir nada: quem recusa é o assert', () => {
    expect(passwordStrength('curta')).toBe('fraca')
    expect(passwordStrength('abcdefghijkl')).toBe('media')
    expect(passwordStrength('café com pão de manhã')).toBe('forte')
  })
})
