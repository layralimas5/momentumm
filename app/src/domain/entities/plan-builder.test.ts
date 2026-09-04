import { describe, expect, it } from 'vitest'
import { addDays, parseDayKey } from './day'
import { buildPlan, suggestedTarget, type PlanInput } from './plan-builder'

const TODAY = parseDayKey('2026-08-13')

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    axis: 'leitura',
    title: 'Ler 6 livros',
    target: 600,
    today: TODAY,
    deadline: addDays(TODAY, 59),
    daysPerWeek: 5,
    ...overrides,
  }
}

describe('buildPlan', () => {
  it('divide o alvo pelas sessões que cabem no prazo', () => {
    // 60 dias com 5 dias por semana dá 42 sessões; 600 páginas em 42 sessões.
    const plan = buildPlan(input())
    expect(plan.totalSessions).toBe(42)
    expect(plan.perSession).toBe(Math.ceil(600 / 42))
  })

  it('é determinístico: mesma entrada, mesmo plano', () => {
    expect(buildPlan(input())).toEqual(buildPlan(input()))
  })

  it('a primeira ação cai hoje e nasce como prioridade principal', () => {
    const [first] = buildPlan(input()).tasks
    expect(first?.day).toBe(TODAY)
    expect(first?.isMainPriority).toBe(true)
  })

  it('só existe uma prioridade principal no plano', () => {
    const main = buildPlan(input()).tasks.filter((task) => task.isMainPriority)
    expect(main).toHaveLength(1)
  })

  it('o hábito vem com versão mínima menor que o alvo', () => {
    const [habit] = buildPlan(input()).habits
    expect(habit?.minimalTarget).toBeGreaterThan(0)
    expect(habit?.minimalTarget).toBeLessThanOrEqual(habit?.target ?? 0)
  })

  it('cinco dias por semana viram os dias úteis', () => {
    const [habit] = buildPlan(input({ daysPerWeek: 5 })).habits
    expect(habit?.weekdays).toEqual([1, 2, 3, 4, 5])
  })

  it('todo dia é representado por lista vazia, como o hábito já faz', () => {
    const [habit] = buildPlan(input({ daysPerWeek: 7 })).habits
    expect(habit?.weekdays).toEqual([])
  })

  it('plano folgado não gera aviso', () => {
    const plan = buildPlan(input({ target: 300 }))
    expect(plan.feasibility).toBe('confortavel')
    expect(plan.warning).toBeNull()
    expect(plan.suggestedDeadline).toBeNull()
  })

  it('plano impossível avisa e sugere um prazo que cabe', () => {
    const plan = buildPlan(input({ target: 10_000, deadline: addDays(TODAY, 29) }))
    expect(plan.feasibility).toBe('irreal')
    expect(plan.warning).toContain('prazo')
    expect(plan.suggestedDeadline).not.toBeNull()
  })

  it('o prazo sugerido devolve o plano pro tamanho confortável', () => {
    const impossible = buildPlan(input({ target: 10_000, deadline: addDays(TODAY, 29) }))
    const fixed = buildPlan(
      input({ target: 10_000, deadline: impossible.suggestedDeadline ?? TODAY }),
    )
    expect(fixed.feasibility).not.toBe('irreal')
  })

  it('o ritmo semanal cobre o alvo dentro do prazo', () => {
    const plan = buildPlan(input())
    const weeks = 60 / 7
    expect(plan.goal.target * weeks).toBeGreaterThanOrEqual(600)
  })

  it('eixo medido em minutos estima a ação pelo próprio tempo', () => {
    const plan = buildPlan(input({ axis: 'treino', target: 900, daysPerWeek: 3 }))
    const [first] = plan.tasks
    expect(first?.estimatedMin).toBe(plan.perSession)
  })

  it('frequência fora da faixa é normalizada em vez de quebrar', () => {
    expect(() => buildPlan(input({ daysPerWeek: 0 }))).not.toThrow()
    expect(buildPlan(input({ daysPerWeek: 99 })).sessionsPerWeek).toBe(7)
  })
})

describe('suggestedTarget', () => {
  it('cresce com o prazo', () => {
    expect(suggestedTarget('leitura', 90)).toBeGreaterThan(suggestedTarget('leitura', 30))
  })

  it('nunca sugere zero', () => {
    expect(suggestedTarget('meditacao', 7)).toBeGreaterThan(0)
  })
})
