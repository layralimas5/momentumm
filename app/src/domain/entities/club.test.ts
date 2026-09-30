import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  assertValidClubDescription,
  assertValidClubName,
  canAdminister,
  isClubRunning,
  rankClubMembers,
  type Club,
} from './club'

function club(overrides: Partial<Club> = {}): Club {
  return {
    id: 'c1',
    ownerId: 'lay',
    name: 'Projeto 90 Dias',
    description: null,
    category: 'treino',
    cover: 'brasa',
    privacy: 'aberto',
    createdAt: new Date('2026-09-01'),
    archivedAt: null,
    ...overrides,
  }
}

describe('validação do clube', () => {
  it('recusa nome curto ou longo demais', () => {
    expect(() => assertValidClubName('ab')).toThrow(DomainError)
    expect(() => assertValidClubName('a'.repeat(61))).toThrow(DomainError)
    expect(() => assertValidClubName('Projeto 90 Dias')).not.toThrow()
  })

  it('a descrição cabe em 280 caracteres, e vazia é válida', () => {
    expect(() => assertValidClubDescription(null)).not.toThrow()
    expect(() => assertValidClubDescription('a'.repeat(281))).toThrow(DomainError)
  })
})

describe('rankClubMembers', () => {
  it('numera a partir de 1, na ordem que veio', () => {
    const linhas = rankClubMembers([
      { userId: 'a', name: 'Ana', avatarUrl: null, days: 12 },
      { userId: 'b', name: 'Bia', avatarUrl: null, days: 7 },
    ])

    expect(linhas.map((linha) => linha.position)).toEqual([1, 2])
  })

  it('empate fica no mesmo lugar, e a posição seguinte pula', () => {
    const linhas = rankClubMembers([
      { userId: 'a', name: 'Ana', avatarUrl: null, days: 9 },
      { userId: 'b', name: 'Bia', avatarUrl: null, days: 9 },
      { userId: 'c', name: 'Caio', avatarUrl: null, days: 4 },
    ])

    expect(linhas.map((linha) => linha.position)).toEqual([1, 1, 3])
  })
})

describe('administrar o clube', () => {
  it('é do dono, e só com assinatura', () => {
    expect(canAdminister(club(), 'lay', true)).toBe(true)
    expect(canAdminister(club(), 'lay', false)).toBe(false)
    expect(canAdminister(club(), 'outra', true)).toBe(false)
    expect(canAdminister(club(), null, true)).toBe(false)
  })

  it('clube arquivado não se administra', () => {
    expect(canAdminister(club({ archivedAt: new Date() }), 'lay', true)).toBe(false)
  })

  it('perder o PRO não arquiva nada: o clube segue vivo', () => {
    const semPro = club()
    expect(canAdminister(semPro, 'lay', false)).toBe(false)
    expect(isClubRunning(semPro)).toBe(true)
  })
})
