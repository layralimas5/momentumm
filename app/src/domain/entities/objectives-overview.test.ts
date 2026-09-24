import { describe, expect, it } from 'vitest'
import type { ObjectiveProgress } from './objective'
import { overviewOf, type OverviewItem } from './objectives-overview'

/*
  O `ratio` vem de fora do progresso: é o mesmo número que o card mostra, que
  pode ser o do plano em vez do volume. Os dois valores diferentes neste
  helper existem justamente pra travar isso.
*/
function obj(
  ratio: number,
  daysLeft: number,
  status: ObjectiveProgress['status'] = 'no-prazo',
  state: ObjectiveProgress['state'] = 'em-andamento',
): OverviewItem {
  return { ratio, progress: { ratio: 0, daysLeft, status, state } as ObjectiveProgress }
}

describe('overviewOf', () => {
  it('conta só os que estão valendo', () => {
    const resumo = overviewOf([
      obj(0.5, 10),
      obj(1, 0, 'concluido'),
      obj(0.2, 30, 'atrasado', 'pausado'),
    ])
    expect(resumo.active).toBe(1)
  })

  it('a média é simples, não ponderada pelo alvo', () => {
    // Ponderar faria o objetivo de alvo grande afundar a média do outro.
    expect(overviewOf([obj(0.9, 5), obj(0.1, 5)]).averageRatio).toBeCloseTo(0.5)
  })

  it('usa o ratio que a TELA mostra, não o do volume', () => {
    // `progress.ratio` é 0 nos dois; o card mostra 0.8 e 0.4.
    expect(overviewOf([obj(0.8, 5), obj(0.4, 5)]).averageRatio).toBeCloseTo(0.6)
  })

  it('o prazo mostrado é o mais próximo', () => {
    expect(overviewOf([obj(0.5, 60), obj(0.5, 7)]).nearestDeadline).toBe(7)
  })

  it('conta quantos escorregaram', () => {
    const resumo = overviewOf([obj(0.5, 10), obj(0.1, 5, 'atrasado'), obj(0, 0, 'vencido')])
    expect(resumo.behind).toBe(2)
  })

  it('atenção não conta como atrasado: a margem existe pra não cobrar cedo', () => {
    expect(overviewOf([obj(0.4, 10, 'atencao')]).behind).toBe(0)
  })

  it('sem objetivo ativo devolve tudo vazio, sem dividir por zero', () => {
    const resumo = overviewOf([obj(1, 0, 'concluido')])
    expect(resumo).toEqual({ active: 0, averageRatio: null, nearestDeadline: null, behind: 0 })
  })

  it('lista vazia também', () => {
    expect(overviewOf([]).averageRatio).toBeNull()
  })
})
