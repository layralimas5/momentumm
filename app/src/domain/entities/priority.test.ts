import { describe, expect, it } from 'vitest'
import { comparePriority, isPriority, PRIORITIES } from './priority'

describe('comparePriority', () => {
  it('coloca a alta na frente', () => {
    const sorted = [...PRIORITIES].sort(comparePriority)
    expect(sorted).toEqual(['alta', 'media', 'baixa'])
  })

  it('trata iguais como empate', () => {
    expect(comparePriority('media', 'media')).toBe(0)
  })
})

describe('isPriority', () => {
  it('reconhece os três níveis', () => {
    expect(isPriority('alta')).toBe(true)
    expect(isPriority('urgente')).toBe(false)
  })
})
