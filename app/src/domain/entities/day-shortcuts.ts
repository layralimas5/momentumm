import type { GoalProgress } from './goal'
import type { ObjectiveProgress } from './objective'
import type { Win } from './win'
import { addDays, type DayKey } from './day'

/**
 * O resumo de uma linha para cada parte do produto.
 *
 * A tela Hoje mostrava seis cards completos atrás de "ver mais" — versões
 * encolhidas de telas que já existem. Aqui nasce o que substitui isso: o
 * número que faz alguém decidir se vale abrir.
 *
 * A regra de cada linha é a mesma: diga o que está em jogo AGORA, e destaque
 * só quando algo pede atenção. Uma lista em que tudo está destacado é uma
 * lista sem destaque nenhum.
 */

export interface ShortcutSummary {
  /** O texto curto à direita. Null quando não há o que dizer. */
  readonly value: string | null
  /** Pede atenção: atrasado, vencendo, novo. */
  readonly alert: boolean
}

const NADA: ShortcutSummary = { value: null, alert: false }

/**
 * Objetivos: quantos estão em jogo e quantos escorregaram.
 *
 * Pausado e concluído não entram na contagem: o primeiro foi suspenso de
 * propósito e o segundo acabou. Contar os dois faria o número crescer
 * justamente quando a pessoa organiza a casa.
 */
export function objectivesSummary(
  progresses: readonly ObjectiveProgress[],
): ShortcutSummary {
  const ativos = progresses.filter(
    (item) => item.status !== 'concluido' && item.state !== 'pausado',
  )
  if (ativos.length === 0) return NADA

  const atrasados = ativos.filter(
    (item) => item.status === 'atrasado' || item.status === 'vencido',
  ).length

  return {
    value: atrasados > 0 ? `${ativos.length} · ${atrasados} atrasado${atrasados > 1 ? 's' : ''}` : `${ativos.length}`,
    alert: atrasados > 0,
  }
}

/**
 * Metas: quantas e a menor porcentagem.
 *
 * A MENOR, não a média: a média esconde a meta que não saiu do zero, que é
 * exatamente a que precisa ser vista.
 */
export function goalsSummary(progresses: readonly GoalProgress[]): ShortcutSummary {
  const abertas = progresses.filter((item) => !item.achieved)
  if (progresses.length === 0) return NADA
  if (abertas.length === 0) return { value: 'todas batidas', alert: false }

  const menor = Math.min(...abertas.map((item) => item.ratio))
  return {
    value: `${abertas.length} · ${Math.round(menor * 100)}%`,
    alert: menor < 0.25 && abertas.some((item) => item.daysLeft <= 1),
  }
}

/** Foco: minutos de hoje. Zero também é informação — é o convite. */
export function focusSummary(minutesToday: number): ShortcutSummary {
  return { value: `${minutesToday} min hoje`, alert: false }
}

/** Vitórias escritas nos últimos sete dias, contando hoje. */
export function winsSummary(wins: readonly Win[], today: DayKey): ShortcutSummary {
  const desde = addDays(today, -6)
  const total = wins.filter((win) => win.day >= desde && win.day <= today).length
  if (total === 0) return { value: null, alert: false }
  return { value: `${total} na semana`, alert: false }
}

/** Leitura do ritmo: existe insight novo pra ler? */
export function insightSummary(hasInsight: boolean): ShortcutSummary {
  return hasInsight ? { value: '1 nova', alert: false } : NADA
}
