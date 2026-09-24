import { describe, expect, it } from 'vitest'
import { addDays, dayKeyOf } from './day'
import type { GoalProgress } from './goal'
import type { ObjectiveProgress } from './objective'
import type { Win } from './win'
import {
  focusSummary,
  goalsSummary,
  insightSummary,
  objectivesSummary,
  winsSummary,
} from './day-shortcuts'

const TODAY = dayKeyOf(new Date())

function objetivo(
  status: ObjectiveProgress['status'],
  state: ObjectiveProgress['state'] = 'em-andamento',
): ObjectiveProgress {
  return { status, state } as ObjectiveProgress
}

function meta(ratio: number, achieved = false, daysLeft = 5): GoalProgress {
  return { ratio, achieved, daysLeft } as GoalProgress
}

function vitoria(day: string): Win {
  return { day, text: 'algo' } as Win
}

describe('objectivesSummary', () => {
  it('conta os que estão em jogo', () => {
    expect(objectivesSummary([objetivo('no-prazo'), objetivo('atencao')]).value).toBe('2')
  })

  it('destaca quando algum escorregou', () => {
    const resumo = objectivesSummary([objetivo('no-prazo'), objetivo('atrasado')])
    expect(resumo.value).toBe('2 · 1 atrasado')
    expect(resumo.alert).toBe(true)
  })

  it('pluraliza', () => {
    expect(objectivesSummary([objetivo('atrasado'), objetivo('vencido')]).value).toBe(
      '2 · 2 atrasados',
    )
  })

  it('concluído e pausado saem da conta: organizar não pode inflar o número', () => {
    const resumo = objectivesSummary([
      objetivo('no-prazo'),
      objetivo('concluido'),
      objetivo('atrasado', 'pausado'),
    ])
    expect(resumo.value).toBe('1')
    expect(resumo.alert).toBe(false)
  })

  it('sem objetivo ativo não mostra número', () => {
    expect(objectivesSummary([objetivo('concluido')]).value).toBeNull()
  })
})

describe('goalsSummary', () => {
  it('mostra a MENOR porcentagem, não a média', () => {
    // Média seria 50% e esconderia a meta parada em 10%.
    expect(goalsSummary([meta(0.9), meta(0.1)]).value).toBe('2 · 10%')
  })

  it('todas batidas vira elogio curto, sem número', () => {
    expect(goalsSummary([meta(1, true), meta(1, true)]).value).toBe('todas batidas')
  })

  it('destaca só quando está baixa E o prazo aperta', () => {
    expect(goalsSummary([meta(0.1, false, 5)]).alert).toBe(false)
    expect(goalsSummary([meta(0.1, false, 0)]).alert).toBe(true)
  })

  it('sem meta nenhuma não mostra linha', () => {
    expect(goalsSummary([]).value).toBeNull()
  })
})

describe('focusSummary', () => {
  it('zero também é informação: é o convite', () => {
    expect(focusSummary(0).value).toBe('0 min hoje')
  })
})

describe('winsSummary', () => {
  it('conta a semana, contando hoje', () => {
    const wins = [vitoria(TODAY), vitoria(addDays(TODAY, -3))]
    expect(winsSummary(wins, TODAY).value).toBe('2 na semana')
  })

  it('o que passou da semana não conta', () => {
    expect(winsSummary([vitoria(addDays(TODAY, -20))], TODAY).value).toBeNull()
  })
})

describe('insightSummary', () => {
  it('só aparece quando há leitura nova', () => {
    expect(insightSummary(true).value).toBe('1 nova')
    expect(insightSummary(false).value).toBeNull()
  })
})
