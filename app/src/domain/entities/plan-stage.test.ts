import { describe, expect, it } from 'vitest'
import { normalizeWeights, TOTAL_WEIGHT } from './plan-stage'

describe('normalizeWeights', () => {
  it('fecha 100 sem achatar a proporção que veio', () => {
    /*
      A IA dizer "a preparação vale 15 e o meio vale 45" é informação. O ajuste
      existe pra fechar a conta, não pra jogar essa informação fora: antes o
      provider redistribuía em partes iguais e 15/45/40 virava 33/33/34.
    */
    const pesos = normalizeWeights([15, 45, 40])
    expect(pesos.reduce((sum, weight) => sum + weight, 0)).toBe(TOTAL_WEIGHT)
    expect(pesos[0]).toBeLessThan(pesos[1] ?? 0)
    expect(pesos[1]).toBeGreaterThan(pesos[2] ?? 0)
  })

  it('fecha 100 mesmo quando a soma que veio está longe', () => {
    for (const entrada of [[10, 10], [3, 3, 3], [80, 90, 70], [1, 99]]) {
      const pesos = normalizeWeights(entrada)
      expect(pesos.reduce((sum, weight) => sum + weight, 0), String(entrada)).toBe(TOTAL_WEIGHT)
      expect(pesos.every((weight) => weight >= 1), String(entrada)).toBe(true)
    }
  })

  it('peso zero, negativo ou quebrado não derruba a conta', () => {
    const pesos = normalizeWeights([0, -5, Number.NaN, 50])
    expect(pesos.reduce((sum, weight) => sum + weight, 0)).toBe(TOTAL_WEIGHT)
    expect(pesos.every((weight) => weight >= 1)).toBe(true)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(normalizeWeights([])).toEqual([])
  })
})
