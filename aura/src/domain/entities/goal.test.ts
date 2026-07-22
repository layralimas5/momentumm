import { describe, expect, it } from 'vitest'
import { GoalRules } from './goal'

describe('GoalRules.isValidTitle', () => {
  it('aceita títulos dentro do limite', () => {
    expect(GoalRules.isValidTitle('Correr 5km')).toBe(true)
    expect(GoalRules.isValidTitle('ab')).toBe(true)
    expect(GoalRules.isValidTitle('a'.repeat(120))).toBe(true)
  })

  it('rejeita curto demais, longo demais e só espaço', () => {
    expect(GoalRules.isValidTitle('a')).toBe(false)
    expect(GoalRules.isValidTitle('a'.repeat(121))).toBe(false)
    expect(GoalRules.isValidTitle('   ')).toBe(false)
  })
})

describe('GoalRules.clampProgress', () => {
  it('mantém valores válidos', () => {
    expect(GoalRules.clampProgress(0)).toBe(0)
    expect(GoalRules.clampProgress(50)).toBe(50)
    expect(GoalRules.clampProgress(100)).toBe(100)
  })

  it('limita fora da faixa 0–100', () => {
    expect(GoalRules.clampProgress(-20)).toBe(0)
    expect(GoalRules.clampProgress(180)).toBe(100)
  })

  it('arredonda frações', () => {
    expect(GoalRules.clampProgress(33.4)).toBe(33)
    expect(GoalRules.clampProgress(33.6)).toBe(34)
  })

  it('trata NaN como 0 em vez de propagar', () => {
    expect(GoalRules.clampProgress(Number.NaN)).toBe(0)
  })
})

describe('GoalRules.isComplete', () => {
  it('é completa quando o status diz que sim', () => {
    expect(GoalRules.isComplete({ progress: 10, status: 'completed' })).toBe(true)
  })

  it('é completa quando o progresso chega a 100', () => {
    expect(GoalRules.isComplete({ progress: 100, status: 'active' })).toBe(true)
  })

  it('não é completa enquanto está em andamento', () => {
    expect(GoalRules.isComplete({ progress: 99, status: 'active' })).toBe(false)
  })

  it('arquivada com progresso parcial não conta como completa', () => {
    expect(GoalRules.isComplete({ progress: 40, status: 'archived' })).toBe(false)
  })
})
