/**
 * O item de rotina que nasce de uma etapa do plano.
 *
 * É o elo OBJETIVO → PLANO → ROTINA: a etapa diz o que fazer, a rotina diz
 * quando. Vai pela URL (`/app/rotina?novo=1&objetivo=…&titulo=…`) porque a
 * Rotina já abre o formulário assim pelo "+" da barra, e um segundo caminho
 * pro mesmo formulário seria um segundo lugar pra ele quebrar.
 */
export interface RoutinePrefill {
  readonly title: string
  readonly objectiveId: string
}

const MAX_TITLE = 80

export function routinePrefillPath(prefill: RoutinePrefill): string {
  const params = new URLSearchParams({ novo: '1', objetivo: prefill.objectiveId, titulo: prefill.title })
  return `/app/rotina?${params.toString()}`
}

/** `null` quando a URL não veio do plano, ou veio sem o objetivo. */
export function readRoutinePrefill(params: URLSearchParams): RoutinePrefill | null {
  const objectiveId = params.get('objetivo')?.trim()
  if (!objectiveId) return null
  return { objectiveId, title: (params.get('titulo') ?? '').trim().slice(0, MAX_TITLE) }
}
