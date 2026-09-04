import { afterEach, describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  activityType,
  activityTypeList,
  createActivityType,
  isActivityTypeSlug,
  isBuiltinSlug,
  registerCustomActivityTypes,
  slugify,
} from './activity-type'

afterEach(() => {
  registerCustomActivityTypes([])
})

describe('slugify', () => {
  it('tira acento e troca espaço por traço', () => {
    expect(slugify('Aulas de Violão')).toBe('aulas-de-violao')
  })

  it('normaliza pontuação e maiúsculas', () => {
    expect(slugify('  Inglês / Conversação! ')).toBe('ingles-conversacao')
  })

  it('não deixa traço sobrando nas pontas', () => {
    expect(slugify('--Escrita--')).toBe('escrita')
  })

  it('devolve vazio quando não sobra letra nenhuma', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('createActivityType', () => {
  it('cria a área com o nome escrito e mede em minutos', () => {
    const axis = createActivityType({ label: 'Escrita', order: 0 })
    expect(axis.slug).toBe('escrita')
    expect(axis.label).toBe('Escrita')
    expect(axis.unit).toBe('minutos')
    expect(axis.builtin).toBe(false)
  })

  it('recusa nome curto demais', () => {
    expect(() => createActivityType({ label: 'a', order: 0 })).toThrow(DomainError)
  })

  it('recusa nome que não vira slug', () => {
    expect(() => createActivityType({ label: '!!!!', order: 0 })).toThrow(DomainError)
  })

  it('recusa nome que colide com área de fábrica', () => {
    expect(() => createActivityType({ label: 'Leitura', order: 0 })).toThrow(DomainError)
    expect(() => createActivityType({ label: 'Meditação', order: 0 })).toThrow(DomainError)
  })

  it('a cor é estável pela ordem, não sorteada', () => {
    const primeira = createActivityType({ label: 'Escrita', order: 0 })
    const outra = createActivityType({ label: 'Terapia', order: 0 })
    expect(primeira.colorToken).toBe(outra.colorToken)

    const segunda = createActivityType({ label: 'Escrita', order: 1 })
    expect(segunda.colorToken).not.toBe(primeira.colorToken)
  })

  it('colapsa espaços repetidos no nome', () => {
    expect(createActivityType({ label: 'Aulas   de   canto', order: 0 }).label).toBe(
      'Aulas de canto',
    )
  })
})

describe('registro de áreas', () => {
  it('a lista soma as de fábrica com as criadas', () => {
    expect(activityTypeList()).toHaveLength(4)

    registerCustomActivityTypes([createActivityType({ label: 'Escrita', order: 0 })])
    expect(activityTypeList()).toHaveLength(5)
    expect(isActivityTypeSlug('escrita')).toBe(true)
  })

  it('a área criada é encontrada pelo slug', () => {
    registerCustomActivityTypes([createActivityType({ label: 'Violão', order: 0 })])
    expect(activityType('violao').label).toBe('Violão')
  })

  it('slug desconhecido devolve um eixo genérico em vez de estourar', () => {
    // Registro de uma área apagada precisa continuar visível no histórico.
    const orphan = activityType('area-que-sumiu')
    expect(orphan.label).toBe('Area que sumiu')
    expect(orphan.unit).toBe('minutos')
    expect(orphan.builtin).toBe(false)
  })

  it('as de fábrica continuam reconhecidas', () => {
    expect(isBuiltinSlug('leitura')).toBe(true)
    expect(isBuiltinSlug('escrita')).toBe(false)
  })
})
