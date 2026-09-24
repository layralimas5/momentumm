import type { ObjectiveProgress } from './objective'

/**
 * O que o resumo precisa de cada objetivo.
 *
 * O `ratio` vem SEPARADO do progresso de propósito: a tela mostra o avanço do
 * PLANO quando existe plano, e o do volume quando não existe
 * (`ObjectiveView.ratio`). Ler `progress.ratio` aqui faria o topo dizer 5%
 * enquanto os cards logo abaixo dizem 33% e 0% — o app discordando de si
 * mesmo na mesma tela, que é o jeito mais rápido de a pessoa parar de
 * acreditar nos números.
 */
export interface OverviewItem {
  /** O MESMO avanço que o card mostra, de 0 a 1. */
  readonly ratio: number
  readonly progress: ObjectiveProgress
}

/**
 * A tela de Objetivos em três números.
 *
 * A lista responde "como está cada um". Ela não responde "como estou", que é a
 * pergunta que faz alguém abrir a aba — e que hoje só se responde lendo três
 * cards inteiros e somando de cabeça.
 *
 * São os mesmos três números da tela Hoje (Momentum, Hoje, Foco), no mesmo
 * formato. A repetição é deliberada: é ela que faz o app parecer uma coisa só
 * em vez de um conjunto de telas que se parecem por acaso.
 */

export interface ObjectivesOverview {
  /** Quantos estão valendo agora. Pausado e concluído ficam de fora. */
  readonly active: number
  /** Avanço médio dos ativos, de 0 a 1. Null quando não há ativo nenhum. */
  readonly averageRatio: number | null
  /** Dias até o prazo mais próximo entre os ativos. Null quando não há. */
  readonly nearestDeadline: number | null
  /** Quantos escorregaram do ritmo. É o número que pede ação. */
  readonly behind: number
}

export function overviewOf(items: readonly OverviewItem[]): ObjectivesOverview {
  const ativos = items.filter(
    (item) => item.progress.status !== 'concluido' && item.progress.state !== 'pausado',
  )

  if (ativos.length === 0) {
    return { active: 0, averageRatio: null, nearestDeadline: null, behind: 0 }
  }

  /*
    Média simples, não ponderada por alvo.

    Ponderar faria um objetivo de 900 minutos afundar a média de um de 6
    livros, e a pessoa leria "12%" num painel em que os dois estão indo bem.
    Aqui a pergunta é "quanto do que eu quero já andou", e cada objetivo pesa
    por ser um objetivo.
  */
  const soma = ativos.reduce((total, item) => total + item.ratio, 0)

  return {
    active: ativos.length,
    averageRatio: soma / ativos.length,
    nearestDeadline: Math.min(...ativos.map((item) => item.progress.daysLeft)),
    behind: ativos.filter(
      (item) => item.progress.status === 'atrasado' || item.progress.status === 'vencido',
    ).length,
  }
}
