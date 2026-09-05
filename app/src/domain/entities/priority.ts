/**
 * Prioridade. Uma escala só para objetivo, hábito e ação.
 *
 * Três níveis de propósito. Com cinco a pessoa passa a decidir entre "média" e
 * "média-alta" em vez de decidir o que importa, e a escala deixa de ordenar
 * qualquer coisa. Alta existe pra ser escassa: é ela que o dia usa pra
 * desempatar quando não cabe tudo.
 */

export const PRIORITIES = ['baixa', 'media', 'alta'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

/** Peso pra ordenação. Maior vem primeiro. */
export const PRIORITY_WEIGHT: Readonly<Record<Priority, number>> = {
  alta: 3,
  media: 2,
  baixa: 1,
}

export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_WEIGHT[b] - PRIORITY_WEIGHT[a]
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}
