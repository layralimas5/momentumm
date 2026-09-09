import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROFILE_VISIBILITY,
  PROFILE_VISIBILITIES,
  assertValidBio,
  assertValidName,
  initialsOf,
  membershipLabel,
  normalizeHandle,
  suggestHandle,
  weeksSince,
} from './profile'
import { DomainError } from '@/shared/errors'

const NOW = new Date('2026-09-08T12:00:00')

describe('visibilidade do perfil', () => {
  it('tem três degraus e o padrão é o mais fechado', () => {
    expect(PROFILE_VISIBILITIES).toEqual(['privado', 'amigos', 'publico'])
    expect(DEFAULT_PROFILE_VISIBILITY).toBe('privado')
  })
})

describe('tempo de casa', () => {
  it('quem entrou hoje já está na primeira semana', () => {
    expect(weeksSince(NOW, NOW)).toBe(1)
    expect(membershipLabel(NOW, NOW)).toBe('1 semana no Momentumm')
  })

  it('conta semanas cheias a partir da entrada', () => {
    const twelveWeeks = new Date('2026-06-16T12:00:00')
    expect(weeksSince(twelveWeeks, NOW)).toBe(13)
    expect(membershipLabel(twelveWeeks, NOW)).toContain('semanas no Momentumm')
  })

  it('não volta no tempo quando o relógio do aparelho está atrasado', () => {
    const future = new Date('2026-10-01T12:00:00')
    expect(weeksSince(future, NOW)).toBe(1)
  })
})

describe('nome, bio e @', () => {
  it('recusa nome curto demais e bio longa demais', () => {
    expect(() => assertValidName('L')).toThrow(DomainError)
    expect(() => assertValidBio('x'.repeat(161))).toThrow(DomainError)
  })

  it('aceita a bio curta do exemplo', () => {
    expect(() => assertValidBio('Construindo minha melhor versão.')).not.toThrow()
  })

  it('normaliza o @ tirando acento e o que não é letra, número ou _', () => {
    expect(normalizeHandle('Layra Lima!')).toBe('layralima')
    expect(normalizeHandle('José_99')).toBe('jose_99')
  })

  it('sugere um @ a partir do e-mail e garante o mínimo de três letras', () => {
    expect(suggestHandle('layralimas5@gmail.com')).toBe('layralimas5')
    expect(suggestHandle('ab@gmail.com').length).toBeGreaterThanOrEqual(3)
  })

  it('as iniciais cobrem o avatar sem foto', () => {
    expect(initialsOf('Layra Lima')).toBe('LL')
    expect(initialsOf('Lay')).toBe('L')
  })
})
